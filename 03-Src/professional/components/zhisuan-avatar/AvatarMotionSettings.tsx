import { setAvatarMotionMode, useAvatarMotionMode } from './motionPreference';

export function AvatarMotionSettings() {
  const mode = useAvatarMotionMode();
  return (
    <label className="field-preference-item">
      <span>头像动态效果</span>
      <select value={mode} onChange={event => setAvatarMotionMode(event.target.value)}>
        <option value="on">开启（默认）</option>
        <option value="system">跟随系统减少动态效果设置</option>
        <option value="off">关闭（静态表情）</option>
      </select>
    </label>
  );
}
