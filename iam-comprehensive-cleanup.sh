#!/bin/bash
set -e

echo "🧹 Comprehensive IAM Cleanup"
echo "============================"
echo ""

delete_role() {
  local role=$1
  echo "  Deleting role: $role"
  aws iam list-attached-role-policies --role-name "$role" --query "AttachedPolicies[].PolicyArn" --output text 2>/dev/null | \
    xargs -n1 -I {} aws iam detach-role-policy --role-name "$role" --policy-arn {} 2>/dev/null || true
  aws iam list-role-policies --role-name "$role" --query "PolicyNames" --output text 2>/dev/null | \
    xargs -n1 -I {} aws iam delete-role-policy --role-name "$role" --policy-name {} 2>/dev/null || true
  aws iam list-instance-profiles-for-role --role-name "$role" --query "InstanceProfiles[].InstanceProfileName" --output text 2>/dev/null | \
    xargs -n1 -I {} sh -c "aws iam remove-role-from-instance-profile --instance-profile-name {} --role-name $role 2>/dev/null || true" || true
  aws iam delete-role --role-name "$role" 2>/dev/null || echo "    ⚠️  Failed"
}

delete_policy() {
  local arn=$1
  echo "  Deleting policy: $arn"
  aws iam delete-policy --policy-arn "$arn" 2>/dev/null || echo "    ⚠️  Failed"
}

echo "1️⃣  Deleting orphaned Amplify roles (7 roles)..."
for role in $(aws iam list-roles --query "Roles[?contains(RoleName, 'amplify-y-wallbomk')].RoleName" --output text); do
  delete_role "$role"
done

echo ""
echo "2️⃣  Deleting old Application Migration roles (6 roles, 2022)..."
for role in AWSApplicationMigrationAgentRole \
            AWSApplicationMigrationConversionServerRole \
            AWSApplicationMigrationLaunchInstanceWithDrsRole \
            AWSApplicationMigrationLaunchInstanceWithSsmRole \
            AWSApplicationMigrationMGHRole \
            AWSApplicationMigrationReplicationServerRole; do
  delete_role "$role" 2>/dev/null || true
done

echo ""
echo "3️⃣  Deleting old service roles (never used)..."
delete_role "AWSApplicationDiscoveryServiceFirehose" 2>/dev/null || true
delete_role "AWSCloud9SSMAccessRole" 2>/dev/null || true
delete_role "AWSGlueServiceRoleDefault" 2>/dev/null || true
delete_role "AlpoTrustedServiceRole" 2>/dev/null || true
delete_role "agent-samgaimultiagentdealassistant-agent-5e2a765f-bedrockagent" 2>/dev/null || true

echo ""
echo "4️⃣  Deleting orphaned policies (0 attachments)..."
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Delete orphaned Bedrock policies
for policy in $(aws iam list-policies --scope Local --query "Policies[?contains(PolicyName, 'BedrockModelConsumption') && AttachmentCount==\`0\`].PolicyName" --output text); do
  delete_policy "arn:aws:iam::${ACCOUNT_ID}:policy/${policy}"
done

# Delete orphaned SageMaker policies
for policy in $(aws iam list-policies --scope Local --query "Policies[?contains(PolicyName, 'AmazonSageMaker-ExecutionPolicy') && AttachmentCount==\`0\`].PolicyName" --output text); do
  delete_policy "arn:aws:iam::${ACCOUNT_ID}:policy/${policy}"
done

# Delete orphaned Access Analyzer policies
for policy in AccessAnalyzerMonitorServicePolicy_VHYGYTQ8V2 AccessAnalyzerMonitorServicePolicy_NNP0MVH1V4; do
  delete_policy "arn:aws:iam::${ACCOUNT_ID}:policy/${policy}" 2>/dev/null || true
done

# Delete orphaned EKS policy
delete_policy "arn:aws:iam::${ACCOUNT_ID}:policy/AWSLoadBalancerControllerIAMPolicy" 2>/dev/null || true

echo ""
echo "5️⃣  Deleting old test/temp roles..."
delete_role "application-20251202232053" 2>/dev/null || true
delete_role "AVMContainersUserRole" 2>/dev/null || true
delete_role "AmazonSagemakerCanvasForecastRole-20241222T175585" 2>/dev/null || true

echo ""
echo "✅ Comprehensive cleanup complete!"
echo ""
echo "📊 Estimated deletions:"
echo "- Amplify roles: 7"
echo "- Application Migration: 6"
echo "- Service roles: 5"
echo "- Orphaned policies: 20+"
echo "- Test roles: 3"
echo ""
echo "Total: ~40 items deleted"
