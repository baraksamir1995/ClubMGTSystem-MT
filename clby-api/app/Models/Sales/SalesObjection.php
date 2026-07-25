<?php

namespace App\Models\Sales;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class SalesObjection extends Model
{
    use HasUuids;

    protected $table = 'sales_objections';
    protected $keyType = 'string';
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = ['gym_id', 'lead_id', 'offer_id', 'reason', 'notes', 'created_by', 'created_at'];

    protected function casts(): array
    {
        return ['created_at' => 'datetime'];
    }
}
