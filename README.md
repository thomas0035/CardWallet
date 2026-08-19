# CardWallet

A personal card wallet — debit, credit, ID, membership and business cards —
built with Expo / React Native and Supabase.

There is no server. The app talks to Supabase directly, and Postgres Row Level
Security restricts every query to the signed-in user's own rows.

```
mobile-app/     Expo app (Android)
supabase/       Database schema and verification SQL
```

## First-time setup

1. **Database.** In the Supabase dashboard, open SQL Editor and run
   `supabase/schema.sql`, then `supabase/verify.sql`. All five checks in the
   second file must report PASS.

2. **Config.** Copy `mobile-app/.env.example` to `mobile-app/.env` and fill in
   your project URL and publishable key from
   Project Settings → API Keys.

3. **Dependencies.**
   ```
   cd mobile-app
   npm install
   ```

## Running it on your phone

### Over USB — one command, most reliable

Requires `adb`, which ships with Android Studio at
`%LOCALAPPDATA%\Android\Sdk\platform-tools`.

On the phone, once: Settings → About phone → tap **Build number** seven times,
then Settings → System → Developer options → enable **USB debugging**.

Plug the phone in, accept the "Allow USB debugging?" prompt, then:

```
cd mobile-app
npm run phone
```

This launches Expo Go on the device automatically. It needs no network at all —
adb forwards the port over the cable — so it is immune to the Wi-Fi problems
below.

Check the phone is visible first with `adb devices`. A device listed as
`unauthorized` means the on-phone prompt has not been accepted yet.

### Over Wi-Fi — scan the QR code

```
cd mobile-app
npm run lan
```

Then scan the QR code with Expo Go.

**If the QR code does nothing, the usual cause is more than one network
interface on the laptop.** With both Ethernet and Wi-Fi active, Expo may
advertise an address on a subnet the phone cannot reach. Check with:

```
Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike "127.*" }
```

If more than one address is listed, pin Expo to the one on the phone's network:

```
$env:REACT_NATIVE_PACKAGER_HOSTNAME = "192.168.1.x"   # the Wi-Fi address
npm run lan
```

Other causes, in rough order of likelihood: Windows Firewall blocking port 8081
(allow Node.js on **private** networks when prompted), the phone on a guest
network with client isolation, or an Expo Go too old for this project's SDK —
update it from the Play Store.

### Over a tunnel — when the network refuses to cooperate

```
cd mobile-app
npm run tunnel
```

Routes through Expo's servers, bypassing the local network entirely. Slower,
but works on locked-down networks.

## Other commands

| Command | What it does |
|---|---|
| `npm run typecheck` | TypeScript check, no build output |
| `npm run phone` | USB device, cache cleared |
| `npm run lan` | Wi-Fi QR code, cache cleared |
| `npm run tunnel` | Via Expo's relay |

Use a `--clear` variant after changing `.env` — Expo inlines those values at
build time and caches the result.

## Building an installable APK

```
npm install -g eas-cli
eas login
eas build --platform android --profile preview
```

Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` as
EAS environment variables first, or the build ships without config. Download
the `.apk` from the EAS dashboard and install it on the phone.

## A note on the keys

`EXPO_PUBLIC_*` values are inlined into the app bundle and can be extracted
from the APK by anyone. That is fine for the Supabase URL and publishable key —
they identify the project but authorize nothing on their own.

Security rests entirely on the RLS policies in `supabase/schema.sql`. The
`secret` key (`sb_secret_...`, formerly `service_role`) bypasses RLS completely
and must never appear in this app.
