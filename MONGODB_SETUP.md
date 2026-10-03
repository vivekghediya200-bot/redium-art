# MongoDB Atlas Setup Guide for Vercel Deployment

This guide will help you set up MongoDB Atlas for your Vercel-deployed Next.js application.

## Step 1: Create MongoDB Atlas Account

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Sign up for a free account (or log in if you already have one)
3. The free tier includes 512MB of storage, which is sufficient for development and small production apps

## Step 2: Create a New Cluster

1. After logging in, click "Build a Database"
2. Choose the **M0 Sandbox** (Free tier) - it's perfect for getting started
3. Select a cloud provider (AWS, GCP, or Azure)
4. Choose a region closest to your Vercel deployment region (recommended: US East or similar)
5. Give your cluster a name (e.g., "jay-mataji-redium-art")
6. Click "Create Cluster"

## Step 3: Create Database User

1. While the cluster is being created, click "Database Access" in the left sidebar
2. Click "Add New Database User"
3. Choose "Password" authentication
4. Enter a username (e.g., "vercel-user")
5. Generate a strong password or create your own - **save this password securely**
6. Set database privileges to "Read and write to any database"
7. Click "Create User"

## Step 4: Configure Network Access

1. Click "Network Access" in the left sidebar
2. Click "Add IP Address"
3. For development: Add your current IP address
4. For Vercel deployment: Add `0.0.0.0/0` (allows all IPs) OR use Vercel's IP ranges for better security
5. Click "Confirm"

## Step 5: Get Connection String

1. Go to "Database" in the left sidebar
2. Click "Connect" on your cluster
3. Choose "Connect your application"
4. Select Node.js version 3.6 or later
5. Copy the connection string - it will look like:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```

## Step 6: Configure Environment Variables

### Local Development
Create or update your `.env.local` file:
```env
MONGODB_URI=mongodb+srv://vercel-user:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/jay-mataji-redium-art?retryWrites=true&w=majority
```

### Vercel Deployment
1. Go to your Vercel project dashboard
2. Navigate to Settings > Environment Variables
3. Add a new variable:
   - Name: `MONGODB_URI`
   - Value: Your MongoDB connection string
   - Environment: Select Production (and optionally Preview/Development)
4. Click Save

## Step 7: Test the Connection

Run the following command to generate the Prisma client and test the connection:
```bash
npx prisma generate
npx prisma db push
```

## Step 8: Deploy to Vercel

1. Commit your changes
2. Push to your Git repository
3. Vercel will automatically deploy with the new environment variable
4. Your app will now connect to MongoDB Atlas in production

## Important Notes

- **Security**: Never commit `.env.local` to Git. The file is already in your `.gitignore`
- **Connection String**: Replace `<password>` with your actual database password
- **Database Name**: The connection string includes the database name (e.g., `jay-mataji-redium-art`)
- **Scaling**: For production with higher traffic, consider upgrading to a paid MongoDB Atlas tier
- **Backups**: MongoDB Atlas automatically backs up your data on paid tiers

## Troubleshooting

### Connection Timeout
- Check your IP whitelist in Network Access
- Ensure your connection string is correct
- Verify the cluster is ready (not being created)
- Check if cluster is paused and resume it

### Authentication Failed
- Double-check username and password
- Ensure the database user has the correct permissions

### Prisma Errors
- Run `npx prisma generate` after changing environment variables
- Check that `MONGODB_URI` is set correctly in your environment

### SSL/TLS Errors
If you see "SSL routines:ssl3_read_bytes:tlsv1 alert internal error":
- This is likely a network/firewall issue
- Check if you can access cloud.mongodb.com in your browser
- Try adding 0.0.0.0/0 to IP whitelist
- Try using a different network or VPN
- See TROUBLESHOOTING.md for detailed solutions

## Next Steps

After setup:
1. Test your application locally with the MongoDB connection
2. Verify database operations work correctly
3. Deploy to Vercel and test in production
4. Monitor MongoDB Atlas dashboard for performance metrics
