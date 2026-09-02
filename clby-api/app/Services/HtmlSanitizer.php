<?php

namespace App\Services;

use DOMDocument;
use DOMElement;
use DOMNode;

/**
 * Allowlist sanitiser for rich-text announcement bodies.
 *
 * The admin rich-text editor is a contentEditable surface, so what
 * arrives is browser-generated HTML that a determined super-admin (or
 * anyone who steals a super-admin token) could replace with anything.
 * The dashboard renders this with dangerouslySetInnerHTML, so the trust
 * boundary has to be here, on write — everything already in the column
 * is then safe to render without re-checking.
 *
 * Deliberately hand-rolled against DOMDocument rather than pulling in
 * HTMLPurifier: the allowlist is a dozen tags with two attributes, and
 * the project has no HTML-sanitising dependency to extend.
 */
class HtmlSanitizer
{
    /** Tags the editor can produce; everything else is unwrapped or dropped. */
    private const ALLOWED_TAGS = [
        'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's',
        'h2', 'h3', 'ul', 'ol', 'li', 'a', 'blockquote',
    ];

    /** Per-tag attribute allowlist. Anything unlisted is stripped. */
    private const ALLOWED_ATTRS = [
        'a' => ['href', 'target', 'rel'],
    ];

    /** Only these URL schemes may appear in an href. */
    private const ALLOWED_SCHEMES = ['http', 'https', 'mailto'];

    /**
     * Tags whose *content* is discarded entirely rather than unwrapped —
     * unwrapping a <script> would paste its source into the page as text.
     */
    private const DROP_ENTIRELY = ['script', 'style', 'iframe', 'object', 'embed', 'form'];

    public function sanitize(?string $html): string
    {
        $html = trim((string) $html);
        if ($html === '') {
            return '';
        }

        $doc = new DOMDocument();

        // Wrap in a UTF-8 document so DOMDocument doesn't mangle non-ASCII,
        // and suppress warnings from the fragments contentEditable emits.
        $previous = libxml_use_internal_errors(true);
        $doc->loadHTML(
            '<?xml encoding="UTF-8"?><div id="__root">' . $html . '</div>',
            LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD
        );
        libxml_clear_errors();
        libxml_use_internal_errors($previous);

        $root = $doc->getElementById('__root');
        if (!$root) {
            return '';
        }

        $this->clean($root);

        $out = '';
        foreach ($root->childNodes as $child) {
            $out .= $doc->saveHTML($child);
        }

        return trim($out);
    }

    /**
     * Recursively clean a node's children.
     *
     * Iterates over a snapshot of childNodes because the loop mutates the
     * live NodeList — replacing a node mid-iteration would skip siblings.
     */
    private function clean(DOMNode $node): void
    {
        foreach (iterator_to_array($node->childNodes) as $child) {
            if ($child instanceof DOMElement) {
                $tag = strtolower($child->nodeName);

                if (in_array($tag, self::DROP_ENTIRELY, true)) {
                    $child->parentNode?->removeChild($child);
                    continue;
                }

                if (!in_array($tag, self::ALLOWED_TAGS, true)) {
                    // Unknown but harmless wrapper (span, div, font…):
                    // keep the text, lose the tag.
                    $this->clean($child);
                    $this->unwrap($child);
                    continue;
                }

                $this->cleanAttributes($child, $tag);
                $this->clean($child);
                continue;
            }

            // Comments can carry conditional-comment payloads; text is fine.
            if ($child->nodeType === XML_COMMENT_NODE) {
                $child->parentNode?->removeChild($child);
            }
        }
    }

    private function cleanAttributes(DOMElement $el, string $tag): void
    {
        $allowed = self::ALLOWED_ATTRS[$tag] ?? [];

        foreach (iterator_to_array($el->attributes) as $attr) {
            if (!in_array(strtolower($attr->nodeName), $allowed, true)) {
                $el->removeAttribute($attr->nodeName);
            }
        }

        if ($tag === 'a') {
            $href = trim($el->getAttribute('href'));
            if ($href === '' || !$this->isSafeUrl($href)) {
                $el->removeAttribute('href');
                $el->removeAttribute('target');
                $el->removeAttribute('rel');
                return;
            }
            // Links open in a new tab from a dashboard modal; noopener
            // stops the opened page reaching back through window.opener.
            $el->setAttribute('target', '_blank');
            $el->setAttribute('rel', 'noopener noreferrer');
        }
    }

    private function unwrap(DOMElement $el): void
    {
        $parent = $el->parentNode;
        if (!$parent) {
            return;
        }
        while ($el->firstChild) {
            $parent->insertBefore($el->firstChild, $el);
        }
        $parent->removeChild($el);
    }

    /**
     * True when the URL is relative, or absolute with an allowed scheme.
     */
    public function isSafeUrl(string $url): bool
    {
        $url = trim($url);
        if ($url === '') {
            return false;
        }

        // Reject control characters that can smuggle a scheme past a
        // naive check ("java\nscript:").
        if (preg_match('/[\x00-\x1F\x7F]/', $url)) {
            return false;
        }

        $scheme = parse_url($url, PHP_URL_SCHEME);

        // No scheme = relative path or internal route; allowed, but only
        // when it can't be read as a protocol-relative or scheme-ish URL.
        if ($scheme === null || $scheme === false) {
            return !str_starts_with($url, '//') && !str_contains(explode('/', $url)[0] ?? '', ':');
        }

        return in_array(strtolower($scheme), self::ALLOWED_SCHEMES, true);
    }

    /**
     * Plain-text excerpt for the What's New list, derived from the
     * sanitised HTML so the list can never render markup.
     */
    public function excerpt(?string $html, int $length = 140): string
    {
        $text = trim(html_entity_decode(strip_tags((string) $html), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
        $text = preg_replace('/\s+/u', ' ', $text) ?? '';

        if (mb_strlen($text) <= $length) {
            return $text;
        }

        return rtrim(mb_substr($text, 0, $length)) . '…';
    }
}
