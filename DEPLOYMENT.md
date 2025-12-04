# Gnomeville App - Domain Setup Guide

## Quick Deploy Steps

### 1. Deploy to Vercel (Choose One Method)

#### Method A: Vercel Dashboard (Easiest)
1. Go to https://vercel.com/new
2. Sign in/up with GitHub, GitLab, or Email
3. Click "Import Project"
4. Upload the entire project folder
5. Vercel will auto-detect Vite settings
6. Click "Deploy"
7. Wait 30-60 seconds for deployment

#### Method B: Vercel CLI (Current Terminal)
```bash
# You're already logged in, just run:
npx vercel --prod

# Answer the prompts:
# - Project name: gnomeville-app
# - Directory: ./ (just press Enter)
# - Override settings: No (press Enter)
```

---

### 2. Add Custom Domains in Vercel

After deployment, go to your project settings:

1. **Go to**: Vercel Dashboard → Your Project → Settings → Domains
2. **Add these 5 domains**:
   - `gnomeville.app` (main participant site)
   - `admin.gnomeville.app` (admin dashboard)
   - `partners.gnomeville.app` (partner dashboard)
   - `advertisers.gnomeville.app` (advertiser dashboard)
   - `bonus.gnomeville.app` (bonus slot machine - participant/admin only)

Vercel will show you the DNS records to add.

---

### 3. Configure GoDaddy DNS

Log into GoDaddy → My Products → Domains → gnomeville.app → DNS

**Delete any existing A/CNAME records for @ and www first**, then add:

#### For Root Domain (gnomeville.app):
```
Type: A
Name: @
Value: 76.76.21.21
TTL: 600 (or 1 hour)
```

#### For Admin Subdomain:
```
Type: CNAME
Name: admin
Value: cname.vercel-dns.com
TTL: 600
```

#### For Partners Subdomain:
```
Type: CNAME
Name: partners
Value: cname.vercel-dns.com
TTL: 600
```

#### For Advertisers Subdomain:
```
Type: CNAME
Name: advertisers
Value: cname.vercel-dns.com
TTL: 600
```

#### For Bonus Subdomain:
```
Type: CNAME
Name: bonus
Value: cname.vercel-dns.com
TTL: 600
```

#### For WWW (Optional):
```
Type: CNAME
Name: www
Value: cname.vercel-dns.com
TTL: 600
```

---

### 4. Verify DNS Propagation

- **Check**: https://dnschecker.org
- **Enter**: gnomeville.app
- **Wait**: 5-60 minutes (usually 10-15 minutes)

---

### 5. Test Your Domains

After DNS propagates, test each URL:

- https://gnomeville.app (Participant view)
- https://admin.gnomeville.app (Admin dashboard)
- https://partners.gnomeville.app (Partner dashboard)
- https://advertisers.gnomeville.app (Advertiser dashboard)
- https://bonus.gnomeville.app (Bonus slot machine - participant/admin only)
- https://advertisers.gnomeville.app (Advertiser dashboard)

The app will automatically detect the subdomain and show the correct role interface!

---

## Troubleshooting

### "Domain not verified" in Vercel
- Wait 10-15 minutes after adding DNS records
- Click "Refresh" in Vercel domain settings
- Check DNS with: https://dnschecker.org

### "Invalid configuration" error
- Make sure you deleted old A/AAAA records for @ and www
- Verify CNAME points to `cname.vercel-dns.com` (not your vercel URL)

### App shows wrong role
- Clear browser cache
- Check subdomain spelling
- Verify DNS CNAME records are correct

---

## SSL/HTTPS

Vercel automatically provisions SSL certificates via Let's Encrypt.
- Usually ready in 5-10 minutes after domain verification
- No action needed from you!

---

## Next Steps After Deployment

1. Test signup flow on each subdomain
2. Upload test trigger images in Admin
3. Test partner trigger submission
4. Test advertiser coupon creation
5. Test participant scanning (you'll need physical trigger images)

---

## Support

- Vercel Docs: https://vercel.com/docs/concepts/projects/custom-domains
- GoDaddy DNS Help: https://www.godaddy.com/help/manage-dns-records-680
