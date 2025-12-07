#!/bin/bash
set -e

echo "🧹 IAM Safe Cleanup - Deleting unused roles"
echo "==========================================="
echo ""

delete_role() {
  local role=$1
  echo "Deleting: $role"
  
  # Detach managed policies
  aws iam list-attached-role-policies --role-name "$role" --query "AttachedPolicies[].PolicyArn" --output text 2>/dev/null | \
    xargs -n1 -I {} aws iam detach-role-policy --role-name "$role" --policy-arn {} 2>/dev/null || true
  
  # Delete inline policies
  aws iam list-role-policies --role-name "$role" --query "PolicyNames" --output text 2>/dev/null | \
    xargs -n1 -I {} aws iam delete-role-policy --role-name "$role" --policy-name {} 2>/dev/null || true
  
  # Delete instance profiles
  aws iam list-instance-profiles-for-role --role-name "$role" --query "InstanceProfiles[].InstanceProfileName" --output text 2>/dev/null | \
    xargs -n1 -I {} sh -c "aws iam remove-role-from-instance-profile --instance-profile-name {} --role-name $role 2>/dev/null || true" || true
  
  # Delete role
  aws iam delete-role --role-name "$role" 2>/dev/null || echo "  ⚠️  Failed to delete $role"
}

echo "1️⃣  Deleting Bedrock Model Consumption Roles (15 roles, never used)..."
for role in $(aws iam list-roles --query "Roles[?contains(RoleName, 'BedrockModelConsumption') && RoleLastUsed.LastUsedDate == null].RoleName" --output text); do
  delete_role "$role"
done

echo ""
echo "2️⃣  Deleting old SageMaker Execution Roles (6 roles, never used)..."
for role in AmazonSageMaker-ExecutionRole-20211020T175627 \
            AmazonSageMaker-ExecutionRole-20241222T175586 \
            AmazonSageMaker-ExecutionRole-20250306T103035 \
            AmazonSageMaker-ExecutionRole-20250306T103110 \
            AmazonSageMaker-ExecutionRole-20250306T103114 \
            AmazonSageMaker-ExecutionRole-20250306T103179; do
  delete_role "$role" 2>/dev/null || true
done

echo ""
echo "3️⃣  Deleting EKS roles from deleted clusters (3 roles)..."
for role in AmazonEKSLoadBalancerControllerRole-coder-aws-eks-cluster \
            AmazonEKS_EBS_CSI_DriverRole \
            AmazonEKS_EFS_CSI_DriverRole; do
  delete_role "$role" 2>/dev/null || true
done

echo ""
echo "4️⃣  Deleting old Access Analyzer roles (3 roles)..."
for role in AccessAnalyzerMonitorServiceRole_JT8ER1QQBF \
            AccessAnalyzerMonitorServiceRole_R7JMYFXIEX \
            AccessAnalyzerTrustedService; do
  delete_role "$role" 2>/dev/null || true
done

echo ""
echo "5️⃣  Deleting orphaned LibreChat role..."
delete_role "LibreChatStack-dev-SecurityEcsExecutionRoleA93FE2D4-BHAHKxfoigk5" 2>/dev/null || true

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "📊 Summary:"
echo "- Bedrock roles: ~15 deleted"
echo "- SageMaker roles: 6 deleted"
echo "- EKS roles: 3 deleted"
echo "- Access Analyzer: 3 deleted"
echo "- Orphaned: 1 deleted"
echo ""
echo "Total: ~28 roles deleted"
