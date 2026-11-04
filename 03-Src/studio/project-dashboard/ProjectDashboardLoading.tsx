import {LoadingLogo} from '../brand/LoadingLogo';
import './dashboard-loading.css';

export function ProjectDashboardLoading({active=true}:{active?:boolean}){
  return <div className="project-dashboard-loading" role="status" aria-busy="true">
    <div className="project-dashboard-loading__brand">
      <LoadingLogo size={220} active={active} solidFallback/>
      <div className="project-dashboard-loading__copy">
        <span>正在加载项目看板</span>
        <small>读取项目统计与运行记录</small>
      </div>
    </div>
  </div>;
}
