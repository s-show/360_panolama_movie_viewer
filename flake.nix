{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    { nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            # CI（.github/workflows/）と揃えること
            nodejs_22
            pnpm_10
            monolith
            emmet-ls
            typescript-language-server
            eslint_d
            # tests/fixtures/generate.mjs 用（fixture はコミット済みなので通常は不要）
            ffmpeg-headless
          ];

          # Playwright が同梱ブラウザをダウンロードしても NixOS では動かないため、
          # nixpkgs 側の patch 済みブラウザを使う。
          # package.json の @playwright/test は nixpkgs の playwright-driver と
          # 同じバージョンに固定すること（revision が食い違うと起動に失敗する）。
          #   nix eval --raw nixpkgs#playwright-driver.version
          PLAYWRIGHT_BROWSERS_PATH = "${pkgs.playwright-driver.browsers}";
          PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "1";

          shellHook = ''
            echo "Entering custom Nix shell..."
          '';
        };
      }
    );
}
