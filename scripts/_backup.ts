import { prisma } from '@/lib/db';
import { backupToGitHub } from '@/lib/github';

async function main() {
  const config = await prisma.gitHubConfig.findFirst({ orderBy: { createdAt: 'desc' } });
  if (!config) { console.log('NO_CONFIG'); return; }
  console.log('repo:', `${config.githubUsername}/${config.githubRepository}`);
  await prisma.gitHubConfig.update({ where: { id: config.id }, data: { lastBackupStatus: 'IN_PROGRESS' } });
  let last = '';
  const result = await backupToGitHub(
    { username: config.githubUsername, repository: config.githubRepository, token: config.githubToken },
    process.cwd(),
    undefined,
    (p) => { const m = String(p.message || ''); if (m !== last && /Found|Comparing|Committ|complete|error|Uploaded|Deleted/i.test(m)) { last = m; console.log('>', m); } }
  );
  await prisma.gitHubConfig.update({
    where: { id: config.id },
    data: {
      lastBackupAt: new Date(),
      lastBackupCommit: result.commitSha || null,
      lastBackupStatus: result.success ? 'SUCCESS' : 'FAILED',
      lastBackupError: result.success ? null : (result.error || null),
    },
  });
  console.log('RESULT', JSON.stringify({ success: result.success, filesUploaded: result.filesUploaded, commitSha: result.commitSha, message: result.message, error: result.error }));
}
main().catch((e) => { console.error('ERR', e?.message || e); process.exit(1); }).finally(() => prisma.$disconnect());
