<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\MediaFileController;
use Illuminate\Support\Facades\Route;

Route::middleware('web')->group(function (): void {
    Route::get('auth/csrf-token', [AuthController::class, 'csrfToken']);
    Route::post('auth/register', [AuthController::class, 'register']);
    Route::post('auth/login', [AuthController::class, 'login'])->middleware('throttle:login');

    Route::middleware('auth')->group(function (): void {
        Route::get('auth/user', [AuthController::class, 'user']);
        Route::post('auth/logout', [AuthController::class, 'logout']);

        Route::get('files/{file}/content', [MediaFileController::class, 'content'])->name('files.content');
        Route::get('files/{file}/download', [MediaFileController::class, 'download'])->name('files.download');
        Route::apiResource('files', MediaFileController::class);
    });
});
