<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Return a CSRF token so the browser can safely submit session-auth requests.
     */
    public function csrfToken(): JsonResponse
    {
        return response()->json(['csrf_token' => csrf_token()]);
    }

    /**
     * Create an account and establish its authenticated session.
     */
    public function register(Request $request): JsonResponse
    {
        if (is_string($request->input('email'))) {
            $request->merge(['email' => mb_strtolower($request->input('email'))]);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
        ]);

        Auth::login($user);
        $request->session()->regenerate();

        return response()->json(['user' => $this->userData($user)], 201);
    }

    /**
     * Verify credentials and rotate the session identifier against fixation.
     */
    public function login(Request $request): JsonResponse
    {
        if (is_string($request->input('email'))) {
            $request->merge(['email' => mb_strtolower($request->input('email'))]);
        }

        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        if (! Auth::attempt($credentials)) {
            throw ValidationException::withMessages([
                'email' => ['These credentials do not match our records.'],
            ]);
        }

        $request->session()->regenerate();

        $user = $request->user();
        abort_unless($user instanceof User, 401);

        return response()->json(['user' => $this->userData($user)]);
    }

    /**
     * End the current session and invalidate its CSRF token.
     */
    public function logout(Request $request): JsonResponse
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['message' => 'Signed out successfully.']);
    }

    /**
     * Return the currently authenticated account or the standard 401 response.
     */
    public function user(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        return response()->json(['user' => $this->userData($user)]);
    }

    /**
     * Expose only profile fields needed by the React client.
     *
     * @return array{id: int, name: string, email: string}
     */
    private function userData(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
        ];
    }
}
