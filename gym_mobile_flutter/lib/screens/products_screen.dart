import 'dart:async';

import 'package:flutter/material.dart';

import 'package:clby/l10n/l10n.dart';

import '../features/store_events/store_events_ui.dart';
import '../models/product_model.dart';
import '../services/api_service.dart';
import '../widgets/product_card.dart';
import '../widgets/shimmer_loader.dart';

/// Full store — searchable, paginated grid of products (`/api/store/products`).
class ProductsScreen extends StatefulWidget {
  const ProductsScreen({super.key});

  @override
  State<ProductsScreen> createState() => _ProductsScreenState();
}

class _ProductsScreenState extends State<ProductsScreen> {
  final _api = ApiService();
  final _searchController = TextEditingController();
  final _scroll = ScrollController();
  Timer? _debounce;

  List<Product> _items = [];
  int _page = 1;
  bool _hasMore = false;
  bool _loading = true;
  bool _loadingMore = false;
  Object? _error;

  /// Guards against a slow earlier search overwriting a newer one.
  int _requestSeq = 0;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
    _load();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _scroll.dispose();
    _searchController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scroll.position.pixels > _scroll.position.maxScrollExtent - 300) {
      _loadMore();
    }
  }

  Future<void> _load() async {
    final seq = ++_requestSeq;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final page = await _api.getStoreProducts(search: _searchController.text);
      if (!mounted || seq != _requestSeq) return;
      setState(() {
        _items = page.items;
        _page = page.currentPage;
        _hasMore = page.hasMore;
        _loading = false;
      });
    } catch (e) {
      if (!mounted || seq != _requestSeq) return;
      setState(() {
        _error = e;
        _loading = false;
      });
    }
  }

  Future<void> _loadMore() async {
    if (_loading || _loadingMore || !_hasMore) return;
    final seq = _requestSeq;
    setState(() => _loadingMore = true);
    try {
      final page = await _api.getStoreProducts(
        search: _searchController.text,
        page: _page + 1,
      );
      if (!mounted || seq != _requestSeq) return;
      setState(() {
        _items = [..._items, ...page.items];
        _page = page.currentPage;
        _hasMore = page.hasMore;
      });
    } catch (_) {
      // Keep what we have; the next scroll retries.
    } finally {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  void _onSearchChanged(String _) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), _load);
    setState(() {}); // toggles the clear button
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final primary = theme.colorScheme.primary;

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(
        title: Text(context.l10n.storeTitle),
        centerTitle: true,
      ),
      body: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => FocusScope.of(context).unfocus(),
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
              child: TextField(
                controller: _searchController,
                onChanged: _onSearchChanged,
                textInputAction: TextInputAction.search,
                decoration: InputDecoration(
                  hintText: context.l10n.storeSearchHint,
                  prefixIcon: const Icon(Icons.search_rounded),
                  suffixIcon: _searchController.text.isEmpty
                      ? null
                      : IconButton(
                          icon: const Icon(Icons.close_rounded),
                          onPressed: () {
                            _searchController.clear();
                            _onSearchChanged('');
                          },
                        ),
                  filled: true,
                  fillColor: Colors.white,
                  contentPadding: const EdgeInsets.symmetric(vertical: 12),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: const BorderSide(color: kSeHair),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: const BorderSide(color: kSeHair),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: BorderSide(color: primary),
                  ),
                ),
              ),
            ),
            Expanded(
              child: RefreshIndicator(
                color: primary,
                onRefresh: _load,
                child: _buildBody(theme, primary),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBody(ThemeData theme, Color primary) {
    if (_loading && _items.isEmpty) {
      return GridView.count(
        padding: const EdgeInsets.all(16),
        crossAxisCount: 2,
        mainAxisSpacing: 12,
        crossAxisSpacing: 12,
        childAspectRatio: 0.72,
        physics: const AlwaysScrollableScrollPhysics(),
        children: List.generate(
          4,
          (_) => const ShimmerLoader(height: 220, borderRadius: 16),
        ),
      );
    }

    if (_error != null && _items.isEmpty) {
      return _Message(
        icon: Icons.wifi_off_rounded,
        text: storeEventsErrorMessage(context, _error!),
        action: TextButton(
          onPressed: _load,
          child: Text(context.l10n.commonRetry),
        ),
      );
    }

    if (_items.isEmpty) {
      return _Message(
        icon: Icons.shopping_bag_outlined,
        text: _searchController.text.trim().isEmpty
            ? context.l10n.storeEmpty
            : context.l10n.exploreNoResultsFor(_searchController.text.trim()),
      );
    }

    return GridView.builder(
      controller: _scroll,
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: 12,
        crossAxisSpacing: 12,
        childAspectRatio: 0.72,
      ),
      itemCount: _items.length + (_loadingMore ? 1 : 0),
      itemBuilder: (context, i) {
        if (i >= _items.length) {
          return Center(
            child: CircularProgressIndicator(color: primary, strokeWidth: 2),
          );
        }
        return ProductCard(product: _items[i]);
      },
    );
  }
}

class _Message extends StatelessWidget {
  final IconData icon;
  final String text;
  final Widget? action;

  const _Message({required this.icon, required this.text, this.action});

  @override
  Widget build(BuildContext context) {
    // ListView so pull-to-refresh still works on the empty/error state.
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 80),
      children: [
        Icon(icon, size: 44, color: kSeInk2),
        const SizedBox(height: 12),
        Text(
          text,
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 14, color: kSeInk2),
        ),
        if (action != null) ...[
          const SizedBox(height: 8),
          Center(child: action),
        ],
      ],
    );
  }
}
