const { withPodfile } = require('expo/config-plugins');

const MARKER = 'Xcode 26 workaround';

const POST_INSTALL_HOOK = `
    # ${MARKER}: Apple Clang casse consteval dans fmt 11.0.2
    fmt_base = File.join(installer.sandbox.root, 'fmt', 'include', 'fmt', 'base.h')
    if File.exist?(fmt_base)
      content = File.read(fmt_base)
      unless content.include?('${MARKER}')
        patched = content.gsub(
          /^(#elif defined\\(__cpp_consteval\\)\\n#  define FMT_USE_CONSTEVAL) 1/,
          "// ${MARKER}: disable consteval\\n\\\\1 0"
        )
        if patched != content
          File.chmod(0644, fmt_base)
          File.write(fmt_base, patched)
        end
      end
    end
`;

/**
 * Injecte un hook CocoaPods qui désactive FMT_USE_CONSTEVAL.
 * Nécessaire pour compiler fmt 11.0.2 avec Xcode 26.4+.
 */
function withFmtXcode26Fix(config) {
  return withPodfile(config, (config) => {
    const contents = config.modResults.contents;
    if (contents.includes(MARKER)) {
      return config;
    }

    config.modResults.contents = contents.replace(
      /post_install do \|installer\|/,
      `post_install do |installer|\n${POST_INSTALL_HOOK}`
    );
    return config;
  });
}

module.exports = withFmtXcode26Fix;
