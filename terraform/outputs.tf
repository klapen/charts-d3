output "cloudfront_distribution_id" {
  description = "Use this for cache invalidations after a deploy."
  value       = aws_cloudfront_distribution.site.id
}

output "cloudfront_domain_name" {
  description = "The *.cloudfront.net domain the alias records point at."
  value       = aws_cloudfront_distribution.site.domain_name
}

output "certificate_arn" {
  value = aws_acm_certificate.site.arn
}
