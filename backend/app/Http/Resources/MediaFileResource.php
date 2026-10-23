<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Route;

class MediaFileResource extends JsonResource
{
    /**
     * Convert a stored upload into the safe, public API representation.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'description' => $this->description,
            'type' => $this->type,
            'original_name' => $this->original_name,
            'mime_type' => $this->mime_type,
            'size' => $this->size,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
            'content_url' => parse_url(route('files.content', $this->resource), PHP_URL_PATH),
            'download_url' => parse_url(route('files.download', $this->resource), PHP_URL_PATH),
        ];
    }
}
