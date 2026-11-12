#!/bin/sh

# minishop 部署 — 支持 test 环境编译 + 上传：
#   1. npm run build:test  (vite --mode test，加载 .env.test)
#   2. 上传 dist/ -> oss://compute-flux-test/shops
#
# 用法: ./hack/deploy-test-oss.sh [env]   （env 默认 test）

set -eu

# 来源于网络，用于获取当前shell文件的路径
SOURCE="$0"
while [ -h "$SOURCE"  ]; do # resolve $SOURCE until the file is no longer a symlink
    DIR="$( cd -P "$( dirname "$SOURCE"  )" && pwd  )"
    SOURCE="$(readlink "$SOURCE")"
    [ "$SOURCE" != /*  ] && SOURCE="$DIR/$SOURCE" # if $SOURCE was a relative symlink, we need to resolve it relative to the path where the symlink file was located
done
DIR="$( cd -P "$( dirname "$SOURCE"  )" && pwd  )"

cd "$DIR/../"

# 环境 -> 构建脚本 + OSS 目标
ENV="${1:-test}"
case "$ENV" in
  test)
    BUILD="build:test"
    BUCKET="oss://compute-flux-test/shops"
    ;;
  *)
    echo "不支持的环境: $ENV（当前仅支持: test）" >&2
    exit 1
    ;;
esac

echo "==> [build] npm run $BUILD"
npm run "$BUILD"

echo "==> [upload] dist/ -> $BUCKET"
ossutil64 -c ./hack/.config -f --recursive cp dist/ "$BUCKET"

echo "==> [done] $BUCKET"
