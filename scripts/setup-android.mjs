import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const windows = process.platform === 'win32'

function run(binary, args) {
  const command = windows ? `${binary}.cmd` : binary
  console.log(`\n> ${command} ${args.join(' ')}`)
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: windows,
  })
  if (result.error) {
    console.error(result.error.message)
    process.exit(1)
  }
  if (result.status !== 0) process.exit(result.status ?? 1)
}

if (
  !existsSync(resolve(root, '.env')) &&
  !existsSync(resolve(root, '.env.local')) &&
  !process.env.VITE_FIREBASE_API_KEY
) {
  console.warn('Увага: налаштувань Firebase не знайдено. APK збереться, але вхід до реального акаунта не працюватиме.')
}

// npm updates package.json and package-lock.json together, keeping them consistent.
// Pin the v8 local-notifications plugin to Capacitor 8 to prevent a future
// npm latest upgrade from pulling a different incompatible major version.
run('npm', ['install', '--save', '@capacitor/core@^8', '@capacitor/android@^8', '@capacitor/local-notifications@8.3.1', '@capacitor/app@^8', '@capacitor/browser@^8'])
run('npm', ['install', '--save-dev', '@capacitor/cli@^8'])
run('npm', ['run', 'build'])

if (existsSync(resolve(root, 'android', 'app', 'build.gradle'))) {
  run('npx', ['cap', 'sync', 'android'])
} else {
  run('npx', ['cap', 'add', 'android'])
}

// Cap add/sync regenerates MainActivity. Keep the native system bars and
// overscroll fix reproducible in every local and GitHub Actions APK.
run('node', ['scripts/configure-android-window.mjs'])

// Ensure Android's installed package version matches the app's update checker.
run('node', ['scripts/set-android-version.mjs'])

// Keep the launcher icon synchronized whenever Android is regenerated.
run('java', ['scripts/GenerateAndroidIcon.java'])

console.log('\nAndroid-проєкт готовий. Далі: npm run android:open (Android Studio) або GitHub Actions → Android debug APK.')
