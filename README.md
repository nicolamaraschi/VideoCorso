# VideoCorso - Complete Video Course Platform

A comprehensive video course platform built with React, AWS Serverless, Stripe payments, and AWS Cognito authentication.

## 🏗️ Architecture

### Frontend
- **Framework**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **State Management**: React Hooks
- **Authentication**: AWS Amplify + Cognito
- **Routing**: React Router v6
- **Payments**: Stripe Checkout
- **Hosting**: AWS Amplify Hosting

### Backend (AWS Serverless)
- **API**: AWS API Gateway REST API
- **Compute**: AWS Lambda (Python 3.11)
- **Database**: DynamoDB
- **Storage**: S3 + CloudFront
- **Authentication**: AWS Cognito
- **Payments**: Stripe
- **Email**: AWS SES

## 📁 Project Structure

```
VideoCorso/
├── frontend/                 # React application
│   ├── src/
│   │   ├── pages/           # Page components
│   │   ├── components/      # Reusable components
│   │   ├── hooks/           # Custom React hooks
│   │   ├── services/        # API services
│   │   ├── types/           # TypeScript types
│   │   ├── utils/           # Utility functions
│   │   └── styles/          # Custom CSS
│   └── package.json
│
├── backend/                 # AWS Serverless backend
│   ├── infrastructure/      # AWS SAM/CloudFormation
│   │   └── template.yaml   # Complete infrastructure
│   └── lambda/              # Lambda functions
│       ├── payment_handler/
│       ├── course_handler/
│       ├── video_handler/
│       ├── progress_handler/
│       └── admin_handler/
│
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- AWS CLI configured
- AWS SAM CLI
- Python 3.11
- Stripe account
- AWS account

### Frontend Setup

1. **Navigate to frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Create environment file**:
   ```bash
   cp .env.example .env
   ```

4. **Configure environment variables**:
   Edit `.env` with your AWS and Stripe credentials:
   ```env
   VITE_COGNITO_USER_POOL_ID=your-user-pool-id
   VITE_COGNITO_USER_POOL_CLIENT_ID=your-client-id
   VITE_COGNITO_IDENTITY_POOL_ID=your-identity-pool-id
   VITE_API_BASE_URL=your-api-gateway-url
   VITE_STRIPE_PUBLIC_KEY=your-stripe-public-key
   VITE_AWS_REGION=us-east-1
   ```

5. **Run development server**:
   ```bash
   npm run dev
   ```

6. **Build for production**:
   ```bash
   npm run build
   ```

### Backend Setup

1. **Navigate to backend directory**:
   ```bash
   cd backend/infrastructure
   ```

2. **Install Lambda dependencies** (for each Lambda function):
   ```bash
   cd ../lambda/payment_handler
   pip install -r requirements.txt -t .
   ```

3. **Deploy with AWS SAM**:
   ```bash
   cd ../../infrastructure
   sam build
   sam deploy --guided
   ```

4. **Follow the prompts**:
   - Stack Name: `videocorso-prod`
   - AWS Region: `us-east-1`
   - Parameter Environment: `prod`
   - Parameter StripeSecretKey: `sk_...`
   - Parameter StripeWebhookSecret: `whsec_...`
   - Confirm changes: `Y`
   - Allow SAM CLI IAM role creation: `Y`
   - Save arguments to configuration file: `Y`

5. **Note the outputs**:
   After deployment, SAM will output:
   - API Endpoint URL
   - Cognito User Pool ID
   - Cognito User Pool Client ID
   - CloudFront Domain

   Use these values in your frontend `.env` file.

## 🔐 AWS Cognito Setup

### Create Admin User

After deploying the backend, create an admin user:

```bash
aws cognito-idp admin-create-user \
  --user-pool-id YOUR_USER_POOL_ID \
  --username admin@yourdomain.com \
  --user-attributes \
    Name=email,Value=admin@yourdomain.com \
    Name=email_verified,Value=true \
    Name=custom:full_name,Value="Admin User" \
  --temporary-password TempPassword123! \
  --message-action SUPPRESS

aws cognito-idp admin-add-user-to-group \
  --user-pool-id YOUR_USER_POOL_ID \
  --username admin@yourdomain.com \
  --group-name admin
```

## 💳 Stripe Setup

1. Create a Stripe account at [stripe.com](https://stripe.com)
2. Get your API keys from the Stripe Dashboard
3. Set up a webhook endpoint pointing to your API Gateway:
   - URL: `https://your-api-gateway-url/prod/payment/webhook`
   - Events: `checkout.session.completed`, `payment_intent.succeeded`
4. Copy the webhook secret and use it in your SAM deployment

## 📧 AWS SES Setup

1. Verify your sender email in AWS SES:
   ```bash
   aws ses verify-email-identity --email-address noreply@yourdomain.com
   ```

2. If in sandbox mode, also verify recipient emails
3. Request production access for unlimited sending

## 🌐 AWS Amplify Hosting Setup

1. **Connect your repository**:
   - Go to AWS Amplify Console
   - Click "New app" → "Host web app"
   - Connect your GitHub repository
   - Select the `claude/video-course-platform-aws-011CUzH6FBhgYLq2PrHPAvFf` branch

2. **Configure build settings**:
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

3. **Add environment variables** in Amplify Console:
   - All `VITE_*` variables from your `.env` file

4. **Deploy**: Amplify will automatically build and deploy

## 📚 Features

### Student Features
- ✅ Purchase course via Stripe
- ✅ Automatic account creation after payment
- ✅ Video streaming with CloudFront
- ✅ Progress tracking
- ✅ Resume from where you left off
- ✅ Video player with controls (speed, quality, fullscreen)
- ✅ Keyboard shortcuts
- ✅ Mobile responsive design
- ✅ Course completion tracking

### Admin Features
- ✅ Upload videos to S3
- ✅ Create and organize chapters
- ✅ Create and manage lessons
- ✅ Reorder content
- ✅ View student list and progress
- ✅ Manage subscriptions
- ✅ View statistics dashboard
- ✅ Track most viewed videos
- ✅ Monitor revenue

## 🔒 Security Features

- ✅ CloudFront signed URLs for video protection
- ✅ Cognito authentication
- ✅ API Gateway authorization
- ✅ WAF protection
- ✅ HTTPS everywhere
- ✅ Rate limiting
- ✅ CORS configuration
- ✅ SQL injection protection
- ✅ XSS protection

## 📱 Frontend Routes

### Public Routes
- `/` - Landing page
- `/login` - Login page
- `/checkout` - Purchase page

### Student Routes (Protected)
- `/dashboard` - Student dashboard
- `/video/:lessonId` - Video player

### Admin Routes (Protected, Admin Only)
- `/admin` - Admin dashboard
- `/admin/upload` - Upload videos
- `/admin/course` - Manage course structure
- `/admin/students` - Manage students

## 🔧 Backend API Endpoints

### Public Endpoints
- `POST /payment/create-checkout` - Create Stripe checkout
- `POST /payment/webhook` - Stripe webhook handler
- `POST /auth/register` - User registration
- `POST /auth/login` - User login

### Student Endpoints (Authenticated)
- `GET /course/structure` - Get course structure
- `GET /course/video/{lesson_id}` - Get signed video URL
- `POST /progress/update` - Update progress
- `GET /progress/user` - Get user progress
- `GET /user/subscription` - Get subscription info

### Admin Endpoints (Admin Only)
- `POST /admin/video/upload` - Get pre-signed upload URL
- `POST /admin/course/chapter` - Create chapter
- `POST /admin/course/lesson` - Create lesson
- `PUT /admin/course/reorder` - Reorder content
- `GET /admin/students` - List students
- `PATCH /admin/student/{id}` - Update student
- `GET /admin/stats` - Get statistics
- `DELETE /admin/video/{id}` - Delete video

## 🗄️ Database Schema

### DynamoDB Tables

1. **Courses**: Course information
2. **Chapters**: Chapter organization
3. **Lessons**: Video lessons
4. **Purchases**: Payment records
5. **Progress**: Student progress
6. **Users**: User profiles

## 🎨 Customization

### Branding
- Update colors in `tailwind.config.js`
- Replace logo in components
- Modify landing page content

### Course Price
- Update price in `CheckoutPage.tsx`
- Update Stripe product configuration

### Email Templates
- Modify SES email templates in Lambda functions

## 🐛 Troubleshooting

### Frontend Issues
- **Build fails**: Check Node.js version (18+)
- **API errors**: Verify environment variables
- **Auth errors**: Check Cognito configuration

### Backend Issues
- **Lambda timeout**: Increase timeout in SAM template
- **DynamoDB errors**: Check IAM permissions
- **Stripe webhook fails**: Verify webhook secret

## 📈 Monitoring

- **CloudWatch**: Lambda logs and metrics
- **X-Ray**: Request tracing
- **CloudFront**: CDN metrics
- **API Gateway**: API usage metrics

## 💰 Cost Estimation

### AWS Services (Monthly, assuming 100 students)
- **Lambda**: ~$5
- **DynamoDB**: ~$10 (on-demand)
- **S3**: ~$20 (100GB video storage)
- **CloudFront**: ~$30 (1TB transfer)
- **Cognito**: Free tier
- **SES**: Free tier (62,000 emails)
- **API Gateway**: ~$3.50

**Total**: ~$68.50/month

## 📄 License

This project is proprietary and confidential.

## 👥 Support

For issues or questions, contact the development team.

## 🚢 Deployment Checklist

- [ ] Frontend build succeeds
- [ ] Backend SAM deployment succeeds
- [ ] Cognito admin user created
- [ ] Stripe webhook configured
- [ ] SES email verified
- [ ] Amplify hosting configured
- [ ] Environment variables set
- [ ] Test payment flow
- [ ] Test video playback
- [ ] Test admin functions
- [ ] Configure custom domain (optional)
- [ ] Enable CloudWatch alarms
- [ ] Set up backup strategy

## 🔄 Updates and Maintenance

### Frontend Updates
```bash
cd frontend
npm install
npm run build
# Deploy via Amplify (automatic on git push)
```

### Backend Updates
```bash
cd backend/infrastructure
sam build
sam deploy
```

### Database Migrations
- Create migration scripts in `backend/migrations/`
- Run via Lambda or locally with AWS SDK

---

Built with ❤️ for Chiara's Video Course Platform
