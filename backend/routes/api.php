<?php

use App\Http\Controllers\Api\MediaFileController;
use Illuminate\Support\Facades\Route;

Route::get('files/{file}/content', [MediaFileController::class, 'content'])->name('files.content');
Route::get('files/{file}/download', [MediaFileController::class, 'download'])->name('files.download');
Route::apiResource('files', MediaFileController::class);
