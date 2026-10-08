import { prisma } from '../lib/db';
import { backupToGitHub } from '../lib/github';

(async () => {
  const cfg = await prisma.gitHubConfig.findFirst({ orderBy: { createdAt: 'desc' } });
  if (!cfg) throw new Error('No GitHub config');
  const res: any = await backupToGitHub(
    { username: cfg.githubUsername, repository: cfg.githubRepository, token: cfg.githubToken } as any,
    process.cwd(),
    undefined as any,
    () => {}
  );
  console.log('RESULT', JSON.stringify({ success: res?.success, commitSha: res?.commitSha, filesChanged: res?.filesChanged, filesUnchanged: res?.filesUnchanged, filesDeleted: res?.filesDeleted, error: res?.error, message: res?.message }));
  await prisma.gitHubConfig.update({ where: { id: cfg.id }, data: res?.success
    ? { lastBackupAt: new Date(), lastBackupStatus: 'success', lastBackupCommit: res.commitSha ?? null, lastBackupError: null }
    : { lastBackupStatus: 'failed', lastBackupError: String(res?.error ?? 'unknown').slice(0, 500) } });
  await prisma.$disconnect();
})().catch(async (e) => { console.error('FAIL', e?.message); process.exit(1); });
