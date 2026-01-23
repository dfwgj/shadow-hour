/**
 * 前端技能注册模块
 * 用户可以在此文件中添加自定义技能
 * @author DF蓝梦/xierfloat
 * @date 2025-1-20
 */

import type { InlineSkillDefinition } from "@xierfloat-monorepo/nativeScript-ai";

// 导入技能 markdown 文件
import aigisBrainMd from "@/assets/skills/aigis-brain.md";
import scheduleOptimizationMd from "@/assets/skills/schedule-optimization.md";
import meetingPreparationMd from "@/assets/skills/meeting-preparation.md";
import weeklyReviewMd from "@/assets/skills/weekly-review.md";
import timeEstimationMd from "@/assets/skills/time-estimation.md";

/**
 * Aigis 角色知识大脑技能
 * 女神异闻录3 埃癸斯（Aigis）角色完整知识库
 */
export const aigisBrainSkill: InlineSkillDefinition = {
  id: "aigis-brain",
  skillMd: aigisBrainMd
};

/**
 * 日程优化技能
 */
export const scheduleOptimizationSkill: InlineSkillDefinition = {
  id: "schedule-optimization",
  skillMd: scheduleOptimizationMd
};

/**
 * 会议准备技能
 */
export const meetingPreparationSkill: InlineSkillDefinition = {
  id: "meeting-preparation",
  skillMd: meetingPreparationMd
};

/**
 * 周报生成技能
 */
export const weeklyReviewSkill: InlineSkillDefinition = {
  id: "weekly-review",
  skillMd: weeklyReviewMd
};

/**
 * 时间估算技能
 */
export const timeEstimationSkill: InlineSkillDefinition = {
  id: "time-estimation",
  skillMd: timeEstimationMd
};

/**
 * 所有应用内置技能列表
 * 用户可以在此数组中添加自定义技能
 */
export const appSkills: InlineSkillDefinition[] = [
  aigisBrainSkill,
  scheduleOptimizationSkill,
  meetingPreparationSkill,
  weeklyReviewSkill,
  timeEstimationSkill
];

/**
 * 导出默认技能列表
 */
export default appSkills;
