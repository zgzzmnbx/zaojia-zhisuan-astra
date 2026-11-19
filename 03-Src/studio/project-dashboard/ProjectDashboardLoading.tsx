import {lazy,Suspense,useState,type ComponentProps} from 'react';
import {PageLoading} from '../brand/PageLoading';
import './dashboard-loading.css';

const Dashboard=lazy(()=>import('./ProjectDashboard'));

export function ProjectDashboardPanel(props:Omit<ComponentProps<typeof Dashboard>,'onInitialLoading'>){
  const [pending,setPending]=useState(true);
  return <div className="project-dashboard-panel" hidden={!props.active}>
    <Suspense fallback={null}><Dashboard {...props} onInitialLoading={setPending}/></Suspense>
    {props.active&&pending&&<div className="project-dashboard-loading" role="status" aria-busy="true">
      <PageLoading label="正在加载项目看板" detail="读取项目统计与运行记录"/>
    </div>}
  </div>;
}
