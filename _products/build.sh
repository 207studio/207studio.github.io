#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
python3 _products/project-pages-gen.py
python3 _products/constellation-video-gen.py
node _products/blog-gen.mjs

target_dir="$HOME/.cache/cargo-target-ara"
(
    cd _products/gen
    CARGO_TARGET_DIR="$target_dir" RUSTC_WRAPPER= CARGO_PROFILE_DEV_DEBUG=0 cargo build --release
)
"$target_dir/release/products-gen" _products/site-data.json .
python3 _products/chrome-gen.py
