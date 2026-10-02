#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
TWA="$ROOT/twa"
cd "$TWA"

echo '== WyteLab TWA Termux build =='
for cmd in node npm java gradle keytool; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing: $cmd"
    echo
    echo 'Install the Android/Node toolchain in Termux first, for example:'
    echo '  pkg update'
    echo '  pkg install nodejs-lts openjdk-17 gradle'
    exit 1
  fi
done

JAVA_VERSION=$(java -version 2>&1 | head -1 || true)
echo "Java: $JAVA_VERSION"
echo "Node: $(node --version)"
echo "Gradle: $(gradle --version | awk '/Gradle / {print $2; exit}')"

cd "$ROOT"
if [ ! -d node_modules ]; then
  echo 'Installing web dependencies…'
  npm install --no-audit --no-fund
fi

echo 'Checking web source…'
npm run check

echo 'Building web source…'
npm run build

cd "$TWA"
mkdir -p keystore output
KEYSTORE="$TWA/keystore/wytelab-release.jks"
ALIAS='wytelab'
PASSFILE="$TWA/keystore/keystore.env"

GRADLE_VERSION=$(gradle --version | awk '/Gradle / {print $2; exit}')
if [ -z "$GRADLE_VERSION" ]; then
  echo 'Could not determine Gradle version.'
  exit 1
fi
if ! printf '%s\n' "$GRADLE_VERSION" | awk -F. '{exit !($1 > 8 || ($1 == 8 && $2 >= 13))}'; then
  echo "Gradle $GRADLE_VERSION found; this package requires Gradle 8.13+ for Android Gradle Plugin 8.13.0."
  echo 'Upgrade Termux packages and install/update gradle, then rerun.'
  exit 1
fi

if [ -z "${ANDROID_HOME:-}" ]; then
  if [ -d "$PREFIX/lib/android-sdk" ]; then export ANDROID_HOME="$PREFIX/lib/android-sdk"; fi
fi
if [ -n "${ANDROID_HOME:-}" ] && [ ! -d "$ANDROID_HOME/platforms/android-36" ]; then
  echo "Android SDK platform 36 was not found under $ANDROID_HOME."
  echo 'Install Android SDK platform 36/build-tools 36.x using your Termux Android SDK setup, then rerun.'
  exit 1
fi

if [ ! -f "$KEYSTORE" ]; then
  echo 'Creating the release keystore (one-time).'
  echo 'This key is required for future APK updates and Digital Asset Links.'
  umask 077
  while true; do
    read -r -s -p 'Choose keystore password: ' STOREPASS; echo
    read -r -s -p 'Repeat keystore password: ' STOREPASS2; echo
    if [ "$STOREPASS" = "$STOREPASS2" ] && [ -n "$STOREPASS" ]; then break; fi
    echo 'Passwords did not match or were empty. Try again.'
  done
  read -r -s -p 'Choose key password (Enter to reuse keystore password): ' KEYPASS; echo
  [ -n "$KEYPASS" ] || KEYPASS="$STOREPASS"
  keytool -genkeypair -v \
    -keystore "$KEYSTORE" \
    -storepass "$STOREPASS" \
    -keypass "$KEYPASS" \
    -alias "$ALIAS" \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -dname 'CN=WyteLab, OU=WyteLab, O=WyteLab, L=Unknown, ST=Unknown, C=NG'
  printf 'WYTELAB_STOREPASS=%q\nWYTELAB_KEYPASS=%q\n' "$STOREPASS" "$KEYPASS" > "$PASSFILE"
  chmod 600 "$KEYSTORE" "$PASSFILE"
else
  if [ ! -f "$PASSFILE" ]; then
    echo "Existing keystore found but $PASSFILE is missing."
    echo 'For safety, the build script will not guess or reset the keystore password.'
    echo 'Create keystore/keystore.env with:'
    echo '  WYTELAB_STOREPASS=<password>'
    echo '  WYTELAB_KEYPASS=<key-password>'
    exit 1
  fi
  # shellcheck disable=SC1090
  . "$PASSFILE"
  STOREPASS="${WYTELAB_STOREPASS:-}"
  KEYPASS="${WYTELAB_KEYPASS:-$STOREPASS}"
  [ -n "$STOREPASS" ] || { echo 'WYTELAB_STOREPASS is empty.'; exit 1; }
fi

FP=$(keytool -list -v -keystore "$KEYSTORE" -storepass "$STOREPASS" -alias "$ALIAS" | awk -F': ' '/SHA256:/{print $2; exit}')
if [ -z "$FP" ]; then echo 'Could not read the release certificate fingerprint.'; exit 1; fi
cat > "$TWA/output/assetlinks.json" <<EOF
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "ng.name.wyte.app",
      "sha256_cert_fingerprints": ["$FP"]
    }
  }
]
EOF

export WYTELAB_KEYSTORE="$KEYSTORE"
export WYTELAB_STOREPASS="$STOREPASS"
export WYTELAB_KEYALIAS="$ALIAS"
export WYTELAB_KEYPASS="$KEYPASS"

gradle --no-daemon --stacktrace assembleRelease
cp -f app/build/outputs/apk/release/app-release.apk output/WyteLab-TWA-release.apk

echo
echo 'BUILD COMPLETE'
echo "APK: $TWA/output/WyteLab-TWA-release.apk"
echo "Asset Links: $TWA/output/assetlinks.json"
echo "SHA-256: $FP"
echo
echo 'Deploy output/assetlinks.json to:'
echo 'https://wyte.name.ng/.well-known/assetlinks.json'
