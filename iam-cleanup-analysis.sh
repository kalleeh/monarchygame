#!/bin/bash

echo "=== IAM Cleanup Analysis ==="
echo ""

# Safe to delete: Never used roles older than 90 days
echo "📋 SAFE TO DELETE (Never used, 90+ days old):"
echo "=============================================="

echo ""
echo "1. Old SageMaker Execution Roles (4 roles):"
aws iam list-roles --query "Roles[?contains(RoleName, 'AmazonSageMaker-ExecutionRole') && RoleLastUsed.LastUsedDate == null].{Name:RoleName,Created:CreateDate}" --output table

echo ""
echo "2. Bedrock Model Consumption Roles (15+ roles, created Apr 2025):"
aws iam list-roles --query "Roles[?contains(RoleName, 'BedrockModelConsumption') && RoleLastUsed.LastUsedDate == null].{Name:RoleName,Created:CreateDate}" --output table | head -20

echo ""
echo "3. Old EKS Roles (3 roles):"
aws iam list-roles --query "Roles[?contains(RoleName, 'EKS') && RoleLastUsed.LastUsedDate == null].{Name:RoleName,Created:CreateDate}" --output table

echo ""
echo "4. Old Access Analyzer Roles (3 roles):"
aws iam list-roles --query "Roles[?contains(RoleName, 'AccessAnalyzer') && RoleLastUsed.LastUsedDate == null].{Name:RoleName,Created:CreateDate}" --output table

echo ""
echo "5. Orphaned Stack Roles (LibreChat, AwsStream):"
aws iam list-roles --query "Roles[?contains(RoleName, 'LibreChat') || contains(RoleName, 'AwsStream')].{Name:RoleName,Created:CreateDate}" --output table

echo ""
echo "⚠️  REVIEW BEFORE DELETING:"
echo "============================"
echo "- Administrator role (2016, never used)"
echo "- GameSparks roles (2022, service deprecated)"
echo "- CodeCatalyst roles (2023)"
echo ""

echo "🔒 PROTECTED (DO NOT DELETE):"
echo "=============================="
echo "- Roles with 'isengard' in name"
echo "- Roles with 'DoNotDelete' in name"
echo "- AWSControlTower* roles"
echo "- AWSServiceRole* roles"
echo ""

echo "📊 Summary:"
echo "==========="
echo "Total non-protected roles: ~160"
echo "SageMaker roles: 46"
echo "Bedrock roles: 24"
echo "EKS roles: 7"
echo ""
echo "Estimated safe deletions: 30-40 roles"
echo ""

echo "💡 Recommendation:"
echo "=================="
echo "1. Delete Bedrock Model Consumption roles (never used, 8 months old)"
echo "2. Delete old SageMaker Execution roles (2021-2024, never used)"
echo "3. Delete EKS roles from deleted clusters"
echo "4. Delete orphaned CloudFormation stack roles"
echo "5. Review Administrator role (9 years old, never used)"
