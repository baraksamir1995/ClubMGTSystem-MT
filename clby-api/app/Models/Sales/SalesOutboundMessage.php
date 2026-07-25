<?php

namespace App\Models\Sales;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class SalesOutboundMessage extends Model
{
    use HasUuids;

    protected $table = 'sales_outbound_messages';
    protected $keyType = 'string';
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = ['gym_id', 'lead_id', 'channel', 'to', 'body', 'status', 'created_at'];

    protected function casts(): array
    {
        return ['created_at' => 'datetime'];
    }
}
