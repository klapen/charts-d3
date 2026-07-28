# Infrastructure — HTTPS front for klapen.com.co

Terraform for the **HTTPS layer only**: an ACM certificate, a CloudFront
distribution in front of the existing S3 static-website bucket, and the Route 53
alias records that point the domain at CloudFront.

Deliberately **not** managed here (referenced read-only or left alone): the S3
bucket itself, the hosted zone, and content deploys (`npm run deploy` still just
`aws s3 cp`s into the bucket).

## Architecture

```
viewer --HTTPS--> CloudFront --HTTP--> S3 website endpoint (us-east-2)
                     ^  ACM cert (us-east-1, DNS-validated)
Route 53 apex + www alias --> CloudFront
```

- Origin is the **website** endpoint, so `/viz/<name>/` still resolves its
  `index.html` automatically.
- Viewer protocol is `redirect-to-https`; min TLS 1.2_2021.

## Prerequisites

- `terraform >= 1.5`, AWS creds via `AWS_PROFILE=klapen`.
- **`apply` needs broader IAM than the `klapen-deploy` user has** (`acm:*`,
  `cloudfront:*`, `route53:ChangeResourceRecordSets`). `plan` is read-only and
  works with the deploy user. Apply with an admin credential or attach a policy
  to `klapen-deploy` first.
- State is **local and gitignored** — don't lose `terraform.tfstate`.

## Usage

```bash
cd terraform
export AWS_PROFILE=klapen

terraform init
terraform plan      # safe with the deploy user
terraform apply     # creates cert + CloudFront, then flips the DNS records
```

`apply` order: the cert is issued (validation records written into the zone),
then CloudFront is built, then the four alias records (apex/www × A/AAAA) are
overwritten to point at CloudFront. CloudFront takes ~5–15 min to finish
deploying; the first HTTPS request may lag.

## Cache invalidation after a content deploy

CloudFront caches at the edge, so a fresh `aws s3 cp` won't show up until the TTL
expires or you invalidate:

```bash
terraform output -raw cloudfront_distribution_id   # note the ID
aws cloudfront create-invalidation --distribution-id <ID> --paths '/*'
```

## Rollback

The cutover is just the alias records. To revert to plain-HTTP S3, repoint the
apex/www `A` records back to `klapen.com.co.s3-website.us-east-2.amazonaws.com`
(the AAAA records can be deleted). CloudFront and the cert can stay — they cost
nothing while idle.
