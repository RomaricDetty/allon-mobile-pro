#!/usr/bin/env node

/**
 * Script de vérification de l'installation du système de tracking
 * 
 * Usage: node scripts/check-tracking-setup.js
 */

const fs = require('fs');
const path = require('path');

// Couleurs pour le terminal
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  success: (msg) => console.log(`${colors.green} ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red} ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow} ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue} ${msg}${colors.reset}`),
  title: (msg) => console.log(`\n${colors.cyan}${msg}${colors.reset}\n`),
};

// Fichiers requis
const requiredFiles = [
  'services/socket.service.ts',
  'services/location-tracking.service.ts',
  'services/tracking.config.ts',
  'services/index.ts',
  'hooks/use-bus-tracking.ts',
  'components/BusTrackingControl.tsx',
  'utils/tracking-stats.ts',
  'types/tracking.types.ts',
];

// Fichiers de documentation
const docFiles = [
  'TRACKING_README.md',
  'TRACKING_QUICKSTART.md',
  'INTEGRATION_GUIDE.md',
  'docs/TRACKING_GUIDE.md',
];

// Dépendances npm requises
const requiredDependencies = [
  'socket.io-client',
  'expo-location',
  '@react-native-async-storage/async-storage',
];

/**
 * Vérifier l'existence d'un fichier
 */
function checkFile(filePath) {
  const fullPath = path.join(process.cwd(), filePath);
  return fs.existsSync(fullPath);
}

/**
 * Vérifier les dépendances npm
 */
function checkDependencies() {
  log.title('📦 Vérification des dépendances npm');
  
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    log.error('package.json introuvable');
    return false;
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  let allFound = true;
  
  requiredDependencies.forEach(dep => {
    if (dependencies[dep]) {
      log.success(`${dep} (${dependencies[dep]})`);
    } else {
      log.error(`${dep} manquant`);
      allFound = false;
    }
  });

  return allFound;
}

/**
 * Vérifier les fichiers de code
 */
function checkCodeFiles() {
  log.title('📁 Vérification des fichiers de code');
  
  let allFound = true;
  
  requiredFiles.forEach(file => {
    if (checkFile(file)) {
      log.success(file);
    } else {
      log.error(`${file} manquant`);
      allFound = false;
    }
  });

  return allFound;
}

/**
 * Vérifier les fichiers de documentation
 */
function checkDocFiles() {
  log.title('Vérification de la documentation');
  
  let allFound = true;
  
  docFiles.forEach(file => {
    if (checkFile(file)) {
      log.success(file);
    } else {
      log.warning(`${file} manquant (optionnel)`);
    }
  });

  return allFound;
}

/**
 * Vérifier la configuration app.json
 */
function checkAppJson() {
  log.title('Vérification de app.json');
  
  const appJsonPath = path.join(process.cwd(), 'app.json');
  
  if (!fs.existsSync(appJsonPath)) {
    log.error('app.json introuvable');
    return false;
  }

  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
  const plugins = appJson.expo?.plugins || [];
  
  const locationPlugin = plugins.find(p => 
    Array.isArray(p) && p[0] === 'expo-location'
  );

  if (locationPlugin) {
    log.success('Plugin expo-location configuré');
    
    const config = locationPlugin[1] || {};
    
    if (config.isAndroidBackgroundLocationEnabled) {
      log.success('Background location activé (Android)');
    } else {
      log.warning('Background location non activé (Android)');
    }
    
    if (config.isAndroidForegroundServiceEnabled) {
      log.success('Foreground service activé (Android)');
    } else {
      log.warning('Foreground service non activé (Android)');
    }
    
    return true;
  } else {
    log.error('Plugin expo-location non configuré');
    log.info('Ajoutez le plugin dans app.json :');
    console.log(`
{
  "expo": {
    "plugins": [
      [
        "expo-location",
        {
          "locationAlwaysAndWhenInUsePermission": "...",
          "isAndroidBackgroundLocationEnabled": true,
          "isAndroidForegroundServiceEnabled": true
        }
      ]
    ]
  }
}
    `);
    return false;
  }
}

/**
 * Vérifier les permissions Android
 */
function checkAndroidPermissions() {
  log.title('Vérification des permissions Android');
  
  const manifestPath = path.join(process.cwd(), 'android/app/src/main/AndroidManifest.xml');
  
  if (!fs.existsSync(manifestPath)) {
    log.warning('AndroidManifest.xml introuvable (normal si pas encore compilé)');
    return true;
  }

  const manifest = fs.readFileSync(manifestPath, 'utf8');
  
  const permissions = [
    'ACCESS_FINE_LOCATION',
    'ACCESS_COARSE_LOCATION',
    'ACCESS_BACKGROUND_LOCATION',
    'FOREGROUND_SERVICE',
    'FOREGROUND_SERVICE_LOCATION',
  ];

  let allFound = true;
  
  permissions.forEach(perm => {
    if (manifest.includes(perm)) {
      log.success(perm);
    } else {
      log.warning(`${perm} manquant`);
      allFound = false;
    }
  });

  if (!allFound) {
    log.info('Ajoutez les permissions manquantes dans AndroidManifest.xml');
  }

  return allFound;
}

/**
 * Vérifier les permissions iOS
 */
function checkIOSPermissions() {
  log.title('Vérification des permissions iOS');
  
  const infoPlistPath = path.join(process.cwd(), 'ios/AllonMobilePro/Info.plist');
  
  if (!fs.existsSync(infoPlistPath)) {
    log.warning('Info.plist introuvable (normal si pas encore compilé)');
    return true;
  }

  const infoPlist = fs.readFileSync(infoPlistPath, 'utf8');
  
  const keys = [
    'NSLocationWhenInUseUsageDescription',
    'NSLocationAlwaysAndWhenInUseUsageDescription',
    'UIBackgroundModes',
  ];

  let allFound = true;
  
  keys.forEach(key => {
    if (infoPlist.includes(key)) {
      log.success(key);
    } else {
      log.warning(`${key} manquant`);
      allFound = false;
    }
  });

  if (!allFound) {
    log.info('Ajoutez les clés manquantes dans Info.plist');
  }

  return allFound;
}

/**
 * Afficher les prochaines étapes
 */
function showNextSteps() {
  log.title('Prochaines étapes');
  
  console.log('1. Lire TRACKING_README.md pour une vue d\'ensemble');
  console.log('2. Suivre TRACKING_QUICKSTART.md pour démarrer');
  console.log('3. Configurer les permissions (app.json, AndroidManifest.xml, Info.plist)');
  console.log('4. Intégrer le composant BusTrackingControl dans votre écran');
  console.log('5. Tester sur un appareil réel');
  console.log('');
}

/**
 * Fonction principale
 */
function main() {
  console.log('\n' + '='.repeat(60));
  console.log('Vérification du système de tracking');
  console.log('='.repeat(60));

  const results = {
    dependencies: checkDependencies(),
    codeFiles: checkCodeFiles(),
    docFiles: checkDocFiles(),
    appJson: checkAppJson(),
    androidPermissions: checkAndroidPermissions(),
    iosPermissions: checkIOSPermissions(),
  };

  log.title('Résumé');
  
  const allPassed = Object.values(results).every(r => r === true);
  
  if (allPassed) {
    log.success('Tous les fichiers et dépendances sont présents !');
  } else {
    log.warning('Certains éléments nécessitent votre attention');
  }

  showNextSteps();

  console.log('='.repeat(60) + '\n');
  
  process.exit(allPassed ? 0 : 1);
}

// Exécuter le script
main();
