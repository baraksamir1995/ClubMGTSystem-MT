<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Expense extends Model
{
    use HasUuids;

    protected $table = 'expenses';
    public $incrementing = false;
    protected $keyType = 'string';
    protected $hidden = ['gym_id'];

    public const CATEGORIES = [
        'rent', 'salaries', 'equipment', 'utilities', 'marketing',
        'maintenance', 'software', 'transportation', 'other',
    ];

    // Same vocabulary as payments.payment_method, minus payment_link
    // (which only exists for collecting from members).
    public const PAYMENT_METHODS = ['cash', 'bank_transfer', 'card', 'other'];

    protected $fillable = [
        'gym_id', 'title', 'amount', 'expense_date', 'category',
        'vendor', 'payment_method', 'description', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'float',
            'expense_date' => 'date:Y-m-d',
        ];
    }
}
