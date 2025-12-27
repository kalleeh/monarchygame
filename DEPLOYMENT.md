# Deployment Configuration

## Repository Setup

- **Primary Repository**: AWS CodeCommit (`codecommit://monarchygame`)
- **Mirror Repository**: GitHub (`https://github.com/kalleeh/monarchygame.git`)
- **AWS Amplify Source**: CodeCommit (eu-west-1)

## Deployment Process

### Automatic Deployments
- **Enabled**: `enableBranchAutoBuild: true`
- **Trigger**: Push to `main` branch in CodeCommit
- **Branch**: `main` (production)

### Manual Deployments
Only use manual deployments for:
- Emergency hotfixes
- Testing specific commits
- Rollback scenarios

```bash
aws amplify start-job --app-id d2plhaotxy4zdr --branch-name main --job-type RELEASE --region eu-west-1
```

## Git Workflow

### For Development
1. Make changes locally
2. Commit changes: `git commit -m "Description"`
3. Push to CodeCommit: `git push codecommit main`
4. Deployment automatically triggers
5. Optionally sync to GitHub: `git push origin main`

### Git Remotes
```bash
git remote -v
# codecommit    codecommit://monarchygame (fetch)
# codecommit    codecommit://monarchygame (push)
# origin        https://github.com/kalleeh/monarchygame.git (fetch)
# origin        https://github.com/kalleeh/monarchygame.git (push)
```

## Monitoring Deployments

```bash
# Check latest deployment status
aws amplify list-jobs --app-id d2plhaotxy4zdr --branch-name main --region eu-west-1 --max-items 1

# Get specific job details
aws amplify get-job --app-id d2plhaotxy4zdr --branch-name main --job-id <JOB_ID> --region eu-west-1
```

## Application URLs
- **Production**: https://monarchy.gurum.se
- **Amplify Default**: https://d2plhaotxy4zdr.amplifyapp.com

## Configuration Details
- **App ID**: d2plhaotxy4zdr
- **Region**: eu-west-1
- **Build Compute**: STANDARD_8GB
- **Auto Build**: Enabled
- **Auto Branch Deletion**: Enabled
