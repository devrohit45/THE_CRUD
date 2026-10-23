<?php

use App\Models\MediaFile;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake('local');
    $this->actingAs(User::factory()->create());
});

test('an image can be created, listed, updated, viewed, and deleted', function () {
    $upload = UploadedFile::fake()->image('cover.png', 100, 100);

    $created = $this->postJson('/api/files', [
        'title' => 'Cover image',
        'description' => 'First draft',
        'type' => 'image',
        'file' => $upload,
    ])->assertCreated()
        ->assertJsonPath('data.title', 'Cover image')
        ->assertJsonPath('data.type', 'image');

    $id = $created->json('data.id');
    $record = MediaFile::findOrFail($id);
    Storage::disk('local')->assertExists($record->path);

    $this->getJson('/api/files')
        ->assertOk()
        ->assertJsonPath('data.0.id', $id);

    $this->getJson("/api/files/{$id}")
        ->assertOk()
        ->assertJsonPath('data.title', 'Cover image');

    $this->get($created->json('data.content_url'))
        ->assertOk()
        ->assertHeader('X-Content-Type-Options', 'nosniff');

    $this->putJson("/api/files/{$id}", [
        'title' => 'Updated cover',
        'description' => 'Approved draft',
    ])->assertOk()
        ->assertJsonPath('data.title', 'Updated cover')
        ->assertJsonPath('data.description', 'Approved draft');

    $this->deleteJson("/api/files/{$id}")
        ->assertOk()
        ->assertJsonPath('message', 'File deleted successfully.');

    $this->assertDatabaseMissing('media_files', ['id' => $id]);
    Storage::disk('local')->assertMissing($record->path);
});

test('uploads reject files that do not match the declared resource type', function () {
    $this->postJson('/api/files', [
        'title' => 'Not an image',
        'type' => 'image',
        'file' => UploadedFile::fake()->create('script.txt', 10, 'text/plain'),
    ])->assertUnprocessable()
        ->assertJsonValidationErrors('file');
});

test('the list can be filtered by resource type and title', function () {
    MediaFile::create([
        'user_id' => auth()->id(),
        'title' => 'Annual report',
        'type' => 'document',
        'original_name' => 'report.pdf',
        'path' => 'media-files/report.pdf',
        'mime_type' => 'application/pdf',
        'size' => 100,
    ]);

    MediaFile::create([
        'user_id' => auth()->id(),
        'title' => 'Team photo',
        'type' => 'image',
        'original_name' => 'team.png',
        'path' => 'media-files/team.png',
        'mime_type' => 'image/png',
        'size' => 100,
    ]);

    $this->getJson('/api/files?type=document&search=report')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.title', 'Annual report');
});

test('file endpoints require authentication', function () {
    auth()->logout();

    $this->getJson('/api/files')->assertUnauthorized();
    $this->postJson('/api/files')->assertUnauthorized();
});

test('accounts can register, log in, and log out using session authentication', function () {
    auth()->logout();

    $this->postJson('/api/auth/register', [
        'name' => 'Riley Example',
        'email' => 'riley@example.com',
        'password' => 'correct-horse-battery',
        'password_confirmation' => 'correct-horse-battery',
    ])->assertCreated()
        ->assertJsonPath('user.email', 'riley@example.com');

    $this->postJson('/api/auth/logout')->assertOk();
    $this->postJson('/api/auth/login', [
        'email' => 'riley@example.com',
        'password' => 'correct-horse-battery',
    ])->assertOk()
        ->assertJsonPath('user.name', 'Riley Example');

    $this->getJson('/api/auth/user')->assertOk()
        ->assertJsonPath('user.email', 'riley@example.com');
});

test('accounts cannot read or delete another users files', function () {
    $owner = User::factory()->create();
    $file = MediaFile::create([
        'user_id' => $owner->id,
        'title' => 'Private report',
        'type' => 'document',
        'original_name' => 'report.pdf',
        'path' => 'media-files/report.pdf',
        'mime_type' => 'application/pdf',
        'size' => 100,
    ]);

    $this->getJson("/api/files/{$file->id}")->assertNotFound();
    $this->deleteJson("/api/files/{$file->id}")->assertNotFound();
    $this->assertDatabaseHas('media_files', ['id' => $file->id]);
});

test('the file list contains only the authenticated users records', function () {
    $otherUser = User::factory()->create();
    MediaFile::create([
        'user_id' => $otherUser->id,
        'title' => 'Not mine',
        'type' => 'document',
        'original_name' => 'private.pdf',
        'path' => 'media-files/private.pdf',
        'mime_type' => 'application/pdf',
        'size' => 100,
    ]);

    $this->getJson('/api/files')->assertOk()
        ->assertJsonCount(0, 'data')
        ->assertJsonPath('summary.total', 0);
});
