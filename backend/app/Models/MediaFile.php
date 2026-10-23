<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable([
    'title',
    'description',
    'type',
    'original_name',
    'path',
    'mime_type',
    'size',
])]
class MediaFile extends Model
{
}
