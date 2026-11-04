import xcode from 'xcode';
import { writeFile } from 'node:fs/promises';

const path = 'ios/App/App.xcodeproj/project.pbxproj';
const project = xcode.project(path);
project.parseSync();
if (!project.pbxTargetByName('"ShareExtension"')) {
  const target = project.addTarget('ShareExtension', 'app_extension', 'ShareExtension', 'com.tervory.app.share');
  project.addBuildPhase([], 'PBXSourcesBuildPhase', 'Sources', target.uuid);
  project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', target.uuid);
  project.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', target.uuid);
  const group = project.addPbxGroup([], 'ShareExtension', 'ShareExtension');
  project.addToPbxGroup(group.uuid, project.getFirstProject().firstProject.mainGroup);
  project.addSourceFile('ShareViewController.swift', { target: target.uuid }, group.uuid);
  project.addFile('Info.plist', group.uuid);
  project.addFile('ShareExtension.entitlements', group.uuid);
}
for (const [key, value] of Object.entries({
    INFOPLIST_FILE: 'ShareExtension/Info.plist',
    CODE_SIGN_ENTITLEMENTS: 'ShareExtension/ShareExtension.entitlements',
    IPHONEOS_DEPLOYMENT_TARGET: '15.0', SWIFT_VERSION: '5.0',
    TARGETED_DEVICE_FAMILY: '"1,2"', APPLICATION_EXTENSION_API_ONLY: 'YES',
    CURRENT_PROJECT_VERSION: '1', MARKETING_VERSION: '0.1.0',
    CODE_SIGN_STYLE: 'Automatic', GENERATE_INFOPLIST_FILE: 'NO',
  })) {
    project.updateBuildProperty(key, value, undefined, '"ShareExtension"');
  }
  project.updateBuildProperty('MARKETING_VERSION', '0.1.0', undefined, 'App');
await writeFile(path, project.writeSync());
