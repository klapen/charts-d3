variable "domain_name" {
  description = "Apex domain served by the site."
  type        = string
  default     = "klapen.com.co"
}

variable "subject_alternative_names" {
  description = "Extra hostnames on the cert and CloudFront aliases (e.g. www)."
  type        = list(string)
  default     = ["www.klapen.com.co"]
}

variable "s3_website_endpoint" {
  description = <<-EOT
    Hostname of the existing S3 static-website endpoint that CloudFront pulls
    from. This is the *website* endpoint (region-specific), not the REST/bucket
    endpoint, so subpath index.html resolution keeps working.
  EOT
  type        = string
  default     = "klapen.com.co.s3-website.us-east-2.amazonaws.com"
}

variable "price_class" {
  description = "CloudFront edge coverage. PriceClass_All includes South America (relevant for a .co audience)."
  type        = string
  default     = "PriceClass_All"
}
