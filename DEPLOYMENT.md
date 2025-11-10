# VideoCorso - Deployment Guide

This guide provides step-by-step instructions for deploying the VideoCorso platform to AWS.

## Prerequisites

Before starting, ensure you have:

- [x] AWS Account with admin access
- [x] AWS CLI installed and configured
- [x] AWS SAM CLI installed
- [x] Node.js 18+ installed
- [x] Python 3.11 installed
- [x] Stripe account
- [x] Domain name (optional)

## Deployment Steps

### Step 1: Prepare AWS Account

1. **Create IAM user with appropriate permissions** (if not using admin):
   ```bash
   # Required permissions:
   # - Lambda full access
   # - DynamoDB full access
   # - S3 full access
   # - CloudFront full access
   # - Cognito full access
   # - API Gateway full access
   # - CloudFormation full access
   # - IAM role creation
   # - SES send email
   ```

2. **Configure AWS CLI**:
   ```bash
   aws configure
   # Enter your AWS Access Key ID
   # Enter your AWS Secret Access Key
   # Enter your default region (e.g., us-east-1)
   # Enter your default output format (json)
   ```

### Step 2: Set Up Stripe

1. **Create Stripe account**: https://dashboard.stripe.com/register

2. **Get API keys**:
   - Go to Developers → API keys
   - Copy "Publishable key" (starts with `pk_`)
   - Copy "Secret key" (starts with `sk_`)

3. **Create webhook**:
   - Go to Developers → Webhooks
   - Click "Add endpoint"
   - URL: `https://YOUR_API_GATEWAY_URL/prod/payment/webhook` (update after deployment)
   - Events: Select `checkout.session.completed` and `payment_intent.succeeded`
   - Copy webhook signing secret (starts with `whsec_`)

### Step 3: Deploy Backend Infrastructure

1. **Navigate to infrastructure directory**:
   ```bash
   cd backend/infrastructure
   ```

2. **Build the SAM application**:
   ```bash
   sam build
   ```

3. **Deploy with guided setup** (first time):
   ```bash
   sam deploy --guided
   ```

   Answer the prompts:
   ```
   Stack Name []: videocorso-prod
   AWS Region []: us-east-1
   Parameter Environment [prod]: prod
   Parameter StripeSecretKey []: sk_test_YOUR_STRIPE_SECRET_KEY
   Parameter StripeWebhookSecret []: whsec_YOUR_WEBHOOK_SECRET
   Confirm changes before deploy [Y/n]: Y
   Allow SAM CLI IAM role creation [Y/n]: Y
   Disable rollback [y/N]: N
   Save arguments to configuration file [Y/n]: Y
   SAM configuration file [samconfig.toml]: samconfig.toml
   SAM configuration environment [default]: default
   ```

4. **Note the outputs**:
   ```
   Key                 Value
   ----------------------------------------
   ApiEndpoint        https://abc123.execute-api.us-east-1.amazonaws.com/prod
   UserPoolId         us-east-1_ABC123
   UserPoolClientId   1234567890abcdef
   CloudFrontDomain   d1234567890abc.cloudfront.net
   ```

   **Save these values** - you'll need them for frontend configuration!

5. **Update Stripe webhook URL**:
   - Go back to Stripe Dashboard → Webhooks
   - Update endpoint URL with your actual API Gateway URL
   - URL format: `https://abc123.execute-api.us-east-1.amazonaws.com/prod/payment/webhook`

### Step 4: Configure AWS SES

1. **Verify sender email**:
   ```bash
   aws ses verify-email-identity --email-address noreply@yourdomain.com
   ```

2. **Check verification email** in your inbox and click the link

3. **Request production access** (to send to any email):
   - Go to AWS SES Console
   - Click "Request Production Access"
   - Fill out the form explaining your use case
   - Wait for approval (usually 24-48 hours)

   > Note: In sandbox mode, you can only send to verified emails. Verify test email addresses:
   ```bash
   aws ses verify-email-identity --email-address test@example.com
   ```

### Step 5: Create Admin User

1. **Get User Pool ID** from SAM outputs

2. **Create admin user**:
   ```bash
   aws cognito-idp admin-create-user \
     --user-pool-id YOUR_USER_POOL_ID \
     --username chiara@yourdomain.com \
     --user-attributes \
       Name=email,Value=chiara@yourdomain.com \
       Name=email_verified,Value=true \
       Name=custom:full_name,Value="Chiara Admin" \
       Name=custom:subscription_status,Value=active \
       Name=custom:subscription_end_date,Value=2099-12-31T23:59:59Z \
     --temporary-password TempPass123! \
     --message-action SUPPRESS
   ```

3. **Add to admin group**:
   ```bash
   aws cognito-idp admin-add-user-to-group \
     --user-pool-id YOUR_USER_POOL_ID \
     --username chiara@yourdomain.com \
     --group-name admin
   ```

4. **Note the temporary password** - you'll need it for first login

### Step 6: Deploy Frontend

#### Option A: Deploy to AWS Amplify (Recommended)

1. **Push code to GitHub**:
   ```bash
   git add .
   git commit -m "Initial VideoCorso platform setup"
   git push origin claude/video-course-platform-aws-011CUzH6FBhgYLq2PrHPAvFf
   ```

2. **Set up Amplify Hosting**:
   - Go to AWS Amplify Console
   - Click "New app" → "Host web app"
   - Connect GitHub repository
   - Select repository: `VideoCorso`
   - Select branch: `claude/video-course-platform-aws-011CUzH6FBhgYLq2PrHPAvFf`
   - Build settings (auto-detected):
     ```yaml
     version: 1
     frontend:
       phases:
         preBuild:
           commands:
             - cd frontend
             - npm ci
         build:
           commands:
             - npm run build
       artifacts:
         baseDirectory: frontend/dist
         files:
           - '**/*'
       cache:
         paths:
           - frontend/node_modules/**/*
     ```
   - Click "Next" → "Save and deploy"

3. **Add environment variables in Amplify**:
   - Go to App settings → Environment variables
   - Add variables:
     ```
     VITE_COGNITO_USER_POOL_ID = YOUR_USER_POOL_ID
     VITE_COGNITO_USER_POOL_CLIENT_ID = YOUR_CLIENT_ID
     VITE_API_BASE_URL = YOUR_API_GATEWAY_URL
     VITE_STRIPE_PUBLIC_KEY = YOUR_STRIPE_PUBLISHABLE_KEY
     VITE_AWS_REGION = us-east-1
     ```
   - Click "Save"

4. **Trigger redeploy**:
   - Go to your app in Amplify
   - Click "Redeploy this version"

5. **Note your Amplify URL**: `https://branchname.d1234567890abc.amplifyapp.com`

#### Option B: Deploy to S3 + CloudFront

1. **Create `.env` file**:
   ```bash
   cd frontend
   cp .env.example .env
   ```

2. **Edit `.env` with your values**:
   ```env
   VITE_COGNITO_USER_POOL_ID=us-east-1_ABC123
   VITE_COGNITO_USER_POOL_CLIENT_ID=1234567890abcdef
   VITE_API_BASE_URL=https://abc123.execute-api.us-east-1.amazonaws.com/prod
   VITE_STRIPE_PUBLIC_KEY=pk_test_YOUR_STRIPE_KEY
   VITE_AWS_REGION=us-east-1
   ```

3. **Build the frontend**:
   ```bash
   npm install
   npm run build
   ```

4. **Create S3 bucket for hosting**:
   ```bash
   aws s3 mb s3://videocorso-frontend-prod --region us-east-1
   ```

5. **Enable static website hosting**:
   ```bash
   aws s3 website s3://videocorso-frontend-prod --index-document index.html --error-document index.html
   ```

6. **Upload build files**:
   ```bash
   aws s3 sync dist/ s3://videocorso-frontend-prod --delete
   ```

7. **Set public read permissions**:
   ```bash
   aws s3api put-bucket-policy --bucket videocorso-frontend-prod --policy '{
     "Version": "2012-10-17",
     "Statement": [{
       "Sid": "PublicReadGetObject",
       "Effect": "Allow",
       "Principal": "*",
       "Action": "s3:GetObject",
       "Resource": "arn:aws:s3:::videocorso-frontend-prod/*"
     }]
   }'
   ```

### Step 7: Test the Platform

1. **Access the frontend**:
   - Amplify: `https://branchname.d1234567890abc.amplifyapp.com`
   - S3: `http://videocorso-frontend-prod.s3-website-us-east-1.amazonaws.com`

2. **Test admin login**:
   - Go to `/login`
   - Email: `chiara@yourdomain.com`
   - Password: `TempPass123!` (temporary password)
   - You'll be prompted to change password

3. **Test payment flow**:
   - Go to `/checkout`
   - Use Stripe test card: `4242 4242 4242 4242`
   - Any future expiry date
   - Any CVC
   - Complete purchase

4. **Verify user creation**:
   - Check DynamoDB `purchases` table
   - Check Cognito users list
   - Check email inbox for welcome email

5. **Test video upload** (as admin):
   - Go to `/admin/upload`
   - Upload a test video
   - Note the S3 key

6. **Create test course structure** (as admin):
   - Go to `/admin/course`
   - Create a chapter
   - Create a lesson with the uploaded video's S3 key
   - Set duration in seconds

7. **Test student experience**:
   - Login as the newly created user
   - Go to `/dashboard`
   - Click on a lesson
   - Verify video plays
   - Check progress tracking

### Step 8: Configure Custom Domain (Optional)

#### For Amplify:

1. **Add custom domain in Amplify Console**:
   - Go to App settings → Domain management
   - Click "Add domain"
   - Enter your domain (e.g., `videocorso.com`)
   - Follow DNS configuration instructions

#### For S3/CloudFront:

1. **Request SSL certificate in ACM**:
   ```bash
   aws acm request-certificate \
     --domain-name videocorso.com \
     --domain-name www.videocorso.com \
     --validation-method DNS \
     --region us-east-1
   ```

2. **Create CloudFront distribution for frontend**
3. **Configure Route53** or your DNS provider

### Step 9: Production Checklist

- [ ] Backend deployed successfully
- [ ] Frontend deployed successfully
- [ ] Admin user created and tested
- [ ] Stripe test payment successful
- [ ] SES email verified (production access requested)
- [ ] Test video upload works
- [ ] Test course creation works
- [ ] Test student registration works
- [ ] Test video streaming works
- [ ] Test progress tracking works
- [ ] Stripe webhook configured and tested
- [ ] CloudWatch logs accessible
- [ ] Custom domain configured (if applicable)
- [ ] SSL certificate installed
- [ ] Backup strategy in place
- [ ] Monitoring alerts configured

### Step 10: Ongoing Maintenance

#### Update Frontend:
```bash
cd frontend
# Make changes
npm run build
# Amplify: git push (auto-deploys)
# S3: aws s3 sync dist/ s3://videocorso-frontend-prod --delete
```

#### Update Backend:
```bash
cd backend/infrastructure
# Make changes to template.yaml or Lambda functions
sam build
sam deploy
```

#### Monitor:
```bash
# View Lambda logs
aws logs tail /aws/lambda/prod-videocorso-payment-handler --follow

# View API Gateway metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name Count \
  --dimensions Name=ApiName,Value=prod-videocorso-api \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 3600 \
  --statistics Sum
```

## Troubleshooting

### Frontend Issues

**Problem**: `Cannot read property of undefined` errors
- **Solution**: Check that all environment variables are set correctly

**Problem**: API calls fail with CORS errors
- **Solution**: Verify API Gateway CORS configuration in SAM template

### Backend Issues

**Problem**: Lambda timeout
- **Solution**: Increase timeout in SAM template (max 900 seconds)

**Problem**: DynamoDB throttling
- **Solution**: Switch to on-demand billing or increase provisioned capacity

**Problem**: Stripe webhook fails
- **Solution**: Verify webhook secret is correct and endpoint URL matches

### Payment Issues

**Problem**: Payment succeeds but user not created
- **Solution**: Check Lambda logs for `payment_handler` function

**Problem**: Welcome email not sent
- **Solution**: Verify SES email is verified and check Lambda permissions

## Support

For issues or questions:
- Check CloudWatch logs
- Review SAM deployment outputs
- Verify all environment variables
- Test with Stripe test cards
- Check IAM permissions

## Security Notes

- Never commit `.env` files
- Rotate Stripe keys regularly
- Enable MFA for AWS account
- Use secrets manager for production
- Enable CloudTrail for audit logs
- Configure WAF rules for API Gateway
- Enable S3 bucket versioning
- Set up automated backups

## Cost Optimization

- Use CloudFront cache effectively
- Set DynamoDB to on-demand if traffic is unpredictable
- Use S3 lifecycle policies for old videos
- Monitor and set billing alarms
- Use Lambda reserved concurrency only if needed

---

Deployment guide last updated: 2024
