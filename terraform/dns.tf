# These four records currently alias the S3 website endpoint. allow_overwrite
# lets Terraform take them over and repoint them at CloudFront in place, so the
# cutover has no window where the names fail to resolve. Reverting is a one-line
# change back to the S3 website alias if ever needed.

locals {
  # apex + every SAN, each needing an A (IPv4) and AAAA (IPv6) alias.
  fqdns = concat([var.domain_name], var.subject_alternative_names)

  alias_records = merge(
    { for f in local.fqdns : "${f}-A" => { name = f, type = "A" } },
    { for f in local.fqdns : "${f}-AAAA" => { name = f, type = "AAAA" } },
  )
}

resource "aws_route53_record" "site" {
  for_each = local.alias_records

  zone_id         = data.aws_route53_zone.primary.zone_id
  name            = each.value.name
  type            = each.value.type
  allow_overwrite = true

  alias {
    name    = aws_cloudfront_distribution.site.domain_name
    zone_id = aws_cloudfront_distribution.site.hosted_zone_id
    # CloudFront reports its own health; per-record health checks add nothing.
    evaluate_target_health = false
  }
}
