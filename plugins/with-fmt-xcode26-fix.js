const { withPodfile } = require('expo/config-plugins');

const FMT_MARKER = 'Xcode 26 workaround';
const DEPLOY_MARKER = 'Xcode 26 deployment target';

const FMT_HOOK = `
    # ${FMT_MARKER}: Apple Clang casse consteval dans fmt 11.0.2
    fmt_base = File.join(installer.sandbox.root, 'fmt', 'include', 'fmt', 'base.h')
    if File.exist?(fmt_base)
      content = File.read(fmt_base)
      unless content.include?('${FMT_MARKER}')
        patched = content.gsub(
          /^(#elif defined\\(__cpp_consteval\\)\\n#  define FMT_USE_CONSTEVAL) 1/,
          "// ${FMT_MARKER}: disable consteval\\n\\\\1 0"
        )
        if patched != content
          File.chmod(0644, fmt_base)
          File.write(fmt_base, patched)
        end
      end
    end
`;

const DEPLOY_HOOK = `
    # ${DEPLOY_MARKER}: Xcode 26 refuse les cibles iOS < 15.0
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        current = config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if current.nil? || current.to_f < 15.0
          config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.1'
        end
      end
    end
`;

/**
 * Injecte un hook dans le Podfile si le marqueur est absent.
 */
function injectHook(contents, marker, hook) {
  if (contents.includes(marker)) {
    return contents;
  }
  return contents.replace(
    /post_install do \|installer\|/,
    `post_install do |installer|\n${hook}`
  );
}

/**
 * Compat Xcode 26 : désactive consteval dans fmt et force iOS 15.1+ sur les Pods.
 */
function withFmtXcode26Fix(config) {
  return withPodfile(config, (config) => {
    let contents = config.modResults.contents;
    contents = injectHook(contents, FMT_MARKER, FMT_HOOK);
    contents = injectHook(contents, DEPLOY_MARKER, DEPLOY_HOOK);
    config.modResults.contents = contents;
    return config;
  });
}

module.exports = withFmtXcode26Fix;
