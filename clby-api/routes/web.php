<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return response()->json([
        'service' => 'CLBY API',
        'status' => 'ok',
        'version' => '1.0.0',
    ]);
});
