<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\MediaFileResource;
use App\Models\MediaFile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rules\File;
use RuntimeException;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class MediaFileController extends Controller
{
    /**
     * List records with optional type/search filters and stable pagination.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $filters = $request->validate([
            'type' => ['sometimes', 'nullable', 'in:image,document'],
            'search' => ['sometimes', 'nullable', 'string', 'max:100'],
            'page' => ['sometimes', 'integer', 'min:1'],
        ]);

        $files = $request->user()->mediaFiles()
            ->when($filters['type'] ?? null, fn ($query, $type) => $query->where('type', $type))
            ->when($filters['search'] ?? null, function ($query, $search): void {
                $query->where(function ($query) use ($search): void {
                    $query->where('title', 'like', "%{$search}%")
                        ->orWhere('original_name', 'like', "%{$search}%");
                });
            })
            ->latest()
            ->paginate(12);

        return MediaFileResource::collection($files)->additional([
            'summary' => [
                'total' => $request->user()->mediaFiles()->count(),
                'images' => $request->user()->mediaFiles()->where('type', 'image')->count(),
                'documents' => $request->user()->mediaFiles()->where('type', 'document')->count(),
            ],
        ]);
    }

    /**
     * Validate and store an upload, then save only its metadata in the database.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:150'],
            'description' => ['nullable', 'string', 'max:2000'],
            'type' => ['required', 'in:image,document'],
            'file' => ['required', ...$this->uploadRules($request->input('type'))],
        ]);

        /** @var UploadedFile $upload */
        $upload = $validated['file'];
        $path = $upload->store('media-files', 'local');

        if ($path === false) {
            throw new RuntimeException('The uploaded file could not be saved.');
        }

        $mediaFile = MediaFile::create([
            'user_id' => $request->user()->id,
            'title' => $validated['title'],
            'description' => $validated['description'] ?? null,
            'type' => $validated['type'],
            'original_name' => $upload->getClientOriginalName(),
            'path' => $path,
            'mime_type' => $upload->getMimeType() ?? 'application/octet-stream',
            'size' => $upload->getSize(),
        ]);

        return (new MediaFileResource($mediaFile))->response()->setStatusCode(201);
    }

    /**
     * Return one record using the same safe representation as the list endpoint.
     */
    public function show(MediaFile $file): MediaFileResource
    {
        abort_unless($file->user_id === request()->user()->id, 404);

        return new MediaFileResource($file);
    }

    /**
     * Update metadata and optionally replace the stored upload.
     */
    public function update(Request $request, MediaFile $file): MediaFileResource
    {
        abort_unless($file->user_id === $request->user()->id, 404);

        $validated = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:150'],
            'description' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'file' => ['sometimes', 'required', ...$this->uploadRules($file->type)],
        ]);

        $oldPath = $file->path;
        if (isset($validated['file'])) {
            /** @var UploadedFile $upload */
            $upload = $validated['file'];
            $path = $upload->store('media-files', 'local');

            if ($path === false) {
                throw new RuntimeException('The replacement file could not be saved.');
            }

            $validated['original_name'] = $upload->getClientOriginalName();
            $validated['path'] = $path;
            $validated['mime_type'] = $upload->getMimeType() ?? 'application/octet-stream';
            $validated['size'] = $upload->getSize();
            unset($validated['file']);
        }

        $file->update($validated);

        if ($file->path !== $oldPath && ! Storage::disk('local')->delete($oldPath)) {
            throw new RuntimeException('The previous upload could not be removed from storage.');
        }

        return new MediaFileResource($file->refresh());
    }

    /**
     * Delete a record and its corresponding private file.
     */
    public function destroy(Request $request, MediaFile $file): JsonResponse
    {
        abort_unless($file->user_id === $request->user()->id, 404);

        $path = $file->path;
        $file->delete();

        if (! Storage::disk('local')->delete($path)) {
            throw new RuntimeException('The upload record was deleted, but its stored file could not be removed.');
        }

        return response()->json(['message' => 'File deleted successfully.']);
    }

    /**
     * Display only image uploads inline; documents must use the download route.
     */
    public function content(Request $request, MediaFile $file): BinaryFileResponse
    {
        abort_unless($file->user_id === $request->user()->id, 404);
        abort_unless($file->type === 'image', 404);

        return response()->file($this->storedPath($file), [
            'Content-Type' => $file->mime_type,
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    /**
     * Download the stored upload using its original filename.
     */
    public function download(Request $request, MediaFile $file): BinaryFileResponse
    {
        abort_unless($file->user_id === $request->user()->id, 404);

        return response()->download($this->storedPath($file), $file->original_name, [
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    /**
     * Apply separate extension/MIME and size limits to images and documents.
     *
     * @return array<int, File>
     */
    private function uploadRules(?string $type): array
    {
        return $type === 'image'
            ? [File::image()->types(['jpg', 'jpeg', 'png', 'webp', 'gif'])->max(10240)]
            : [File::types(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv'])->max(20480)];
    }

    /**
     * Resolve files from private storage and return a clear 404 if they are missing.
     */
    private function storedPath(MediaFile $file): string
    {
        abort_unless(Storage::disk('local')->exists($file->path), 404);

        return Storage::disk('local')->path($file->path);
    }
}
