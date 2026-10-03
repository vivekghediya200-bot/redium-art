# Vercel Deployment Guide with MongoDB Atlas

This guide explains how to deploy your Next.js application to Vercel with MongoDB Atlas database integration.

## Prerequisites

- MongoDB Atlas cluster set up (follow [MONGODB_SETUP.md](./MONGODB_SETUP.md))
- Git repository with your code
- Vercel account (free tier works)

## Step 1: Connect Your Repository to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New Project"
3. Import your Git repository (GitHub, GitLab, or Bitbucket)
4. Vercel will automatically detect it's a Next.js project

## Step 2: Configure Environment Variables

### Required Environment Variables

Add these environment variables in your Vercel project settings:

1. Go to your project in Vercel
2. Navigate to **Settings** > **Environment Variables**
3. Add the following variables:

#### MONGODB_URI
- **Name**: `MONGODB_URI`
- **Value**: Your MongoDB Atlas connection string
- **Format**: `mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/jay-mataji-redium-art?retryWrites=true&w=majority`
- **Environments**: Production, Preview, Development

#### JWT_SECRET
- **Name**: `JWT_SECRET`
- **Value**: Generate a secure random string (use: `openssl rand -base64 32` or similar)
- **Environments**: Production, Preview, Development

#### ADMIN_EMAIL (Optional)
- **Name**: `ADMIN_EMAIL`
- **Value**: Your admin email address
- **Default**: `admin@jaymataji.com`
- **Environments**: Production, Preview, Development

#### ADMIN_PASSWORD (Optional)
- **Name**: `ADMIN_PASSWORD`
- **Value**: Your admin password
- **Default**: `Admin@123`
- **Environments**: Production, Preview, Development

#### BLOB_READ_WRITE_TOKEN (If using Vercel Blob)
- **Name**: `BLOB_READ_WRITE_TOKEN`
- **Value**: Get from Vercel Storage settings
- **Environments**: Production, Preview, Development

## Step 3: Configure Build Settings

Vercel automatically detects Next.js settings, but verify:

1. Go to **Settings** > **Build & Development**
2. **Build Command**: `npm run build` (or `prisma generate && next build`)
3. **Output Directory**: `.next`
4. **Install Command**: `npm install`
5. **Framework Preset**: Next.js

## Step 4: Deploy

1. Click **Deploy** in Vercel
2. Wait for the build to complete
3. Your app will be live at `https://your-project.vercel.app`

## Step 5: Verify Database Connection

After deployment:

1. Visit your live site
2. Try to access the admin panel
3. Check if data is being saved to MongoDB Atlas
4. Go to MongoDB Atlas dashboard > Database > Collections to verify data

## Step 6: Monitor and Debug

### Check Logs
- Go to Vercel project > **Deployments**
- Click on a deployment to view logs
- Look for database connection errors

### MongoDB Atlas Monitoring
- Go to MongoDB Atlas dashboard
- Check **Metrics** tab for connection activity
- Review **Logs** for any errors

### Common Issues

#### Connection Timeout
- Verify IP whitelist in MongoDB Atlas Network Access
- Check if `MONGODB_URI` is correct
- Ensure cluster is in the same region as Vercel deployment
- Add 0.0.0.0/0 to whitelist for testing

#### Build Failures
- Check if all environment variables are set
- Verify `prisma generate` runs successfully
- Check build logs for specific errors

#### Runtime Errors
- Verify `MONGODB_URI` is accessible in production
- Check MongoDB Atlas connection string format
- Ensure database user has correct permissions

#### Local Connection Issues
- **Note**: If local connection fails due to network/firewall issues, Vercel deployment may still work
- Vercel's servers have different network access than your local machine
- See TROUBLESHOOTING.md for local connection issues

## Step 7: Custom Domain (Optional)

1. Go to **Settings** > **Domains**
2. Add your custom domain
3. Configure DNS records as instructed by Vercel
4. Wait for SSL certificate to be issued

## Step 8: Automatic Deployments

Vercel automatically deploys when you:
- Push to your main branch
- Open a pull request
- Push to other branches (creates preview deployments)

## Security Best Practices

1. **Never commit `.env.local`** - it's already in `.gitignore`
2. **Use strong passwords** for MongoDB and admin accounts
3. **Rotate secrets periodically** - update environment variables in Vercel
4. **Enable IP whitelisting** in MongoDB Atlas for production
5. **Use Vercel's Environment Variables** for all sensitive data
6. **Enable Vercel Analytics** to monitor performance

## Scaling Considerations

### Free Tier Limits
- Vercel: 100GB bandwidth/month, 6GB build output
- MongoDB Atlas M0: 512MB storage, shared RAM

### When to Upgrade
- High traffic: Upgrade Vercel Pro plan
- Large database: Upgrade MongoDB Atlas (M2+ tier)
- Frequent builds: Consider Vercel Pro

## Backup Strategy

MongoDB Atlas provides:
- Automated backups on paid tiers
- Point-in-time recovery
- Manual snapshots

For free tier:
- Export data regularly using MongoDB Atlas Data API
- Use `mongodump` for local backups

## Next Steps

1. Test all features in production
2. Set up monitoring and alerts
3. Configure custom domain
4. Review MongoDB Atlas performance metrics
5. Set up regular backups if using paid tier

## Support Resources

- [Vercel Documentation](https://vercel.com/docs)
- [MongoDB Atlas Documentation](https://docs.atlas.mongodb.com/)
- [Next.js Deployment Guide](https://nextjs.org/docs/deployment)
