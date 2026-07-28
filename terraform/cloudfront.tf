locals {
  origin_id = "s3-website-${var.domain_name}"
  aliases   = concat([var.domain_name], var.subject_alternative_names)
}

resource "aws_cloudfront_distribution" "site" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "HTTPS front for ${var.domain_name} (S3 website origin)"
  default_root_object = "index.html"
  price_class         = var.price_class
  aliases             = local.aliases

  origin {
    origin_id   = local.origin_id
    domain_name = var.s3_website_endpoint

    # S3 website endpoints only speak HTTP, so the CloudFront->origin hop is
    # http-only. Viewer->CloudFront is still forced to HTTPS below.
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id       = local.origin_id
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    # AWS managed "CachingOptimized" policy — sane defaults, no query strings or
    # cookies forwarded, gzip/brotli honored.
    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.site.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
}
