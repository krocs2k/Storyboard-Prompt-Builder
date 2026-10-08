import { prisma } from '@/lib/db';
import { backupToGitHub } from '@/lib/github';

async function main() {
  const cfg = await prisma.gitHubConfig.findFirst({ orderBy: { createdAt: 'desc' } });
  if (!cfg) { console.log('NO_GITHUB_CONFIG'); return; }
  console.log('Repo:', `${cfg.githubUsername}/${cfg.githubRepository}`);
  await prisma.gitHubConfig.update({ where: { id: cfg.id }, data: { lastBackupStatus: 'IN_PROGRESS' } });
  const result = await backupToGitHub(
    { username: cfg.githubUsername, repository: cfg.githubRepository, token: cfg.githubToken },
    process.cwd(),
    undefined,
    () => {},
  );
  await prisma.gitHubConfig.update({
    where: { id: cfg.id },
    data: {
      lastBackupAt: new Date(),
      lastBackupCommit: result.commitSha || null,
      lastBackupStatus: result.success ? 'SUCCESS' : 'FAILED',
      lastBackupError: result.success ? null : (result.error || null),
    },
  });
  console.log('RESULT', JSON.stringify({ success: result.success, commitSha: result.commitSha, filesUploaded: result.filesUploaded, message: result.message, error: result.error }));
}
main().catch((e) => console.error('ERR', e?.message)).finally(() => prisma.$disconnect());
