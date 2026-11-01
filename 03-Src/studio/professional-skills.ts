export type SkillSummary={id:string;display_name:string;version:string;status:string;status_label:string;description:string;can_create_task:boolean;capabilities:string[]};
export type SkillSnapshot={id:string;display_name:string;version:string;manifest_hash?:string;compatibility_fallback?:boolean};
export type SkillCatalog={default_skill_id:string;items:SkillSummary[]};
export type SkillDetail=SkillSummary&{applicability?:{includes?:string[];excludes?:string[]};sub_skills?:{name:string;description:string;status:string}[];boundary?:string};
export const skillPreferenceKey='astra.professional-skill.v1';
export function selectAvailableSkill(catalog:SkillCatalog,preferred:string){
 const available=catalog.items.filter(item=>item.can_create_task&&['active','beta'].includes(item.status));
 return available.find(item=>item.id===preferred)||available.find(item=>item.id===catalog.default_skill_id)||available[0]||null;
}
export function skillSubmission(skill:SkillSummary|null){
 if(!skill?.can_create_task||!['active','beta'].includes(skill.status))throw new Error('请先选择已上线的专业能力');
 return {skill_id:skill.id,skill_version:skill.version};
}
export function skillShortName(skill:SkillSnapshot){return ({'survey-measurement-limit-price':'勘察测量','general-service-cost-estimation':'通用服务','more-cost-professions':'更多专业'} as Record<string,string>)[skill.id]||skill.display_name;}
