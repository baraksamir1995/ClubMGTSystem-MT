<?php

namespace App\Models\Sales;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class SalesLeadStageHistory extends Model
{
    use HasUuids;

    protected $table = 'sales_lead_stage_history';
    protected $keyType = 'string';
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = ['lead_id', 'from_stage', 'to_stage', 'changed_by', 'reason', 'created_at'];

    protected function casts(): array
    {
        return ['created_at' => 'datetime'];
    }
}
