#include "hyperkitty_bus.h"
#include <string.h>
#include <stdio.h>

/* HyperKitty C-- Bus implementation */

int hk_msg_encode(const hk_message_t *m, char *out, size_t sz) {
  return snprintf(out, sz,
    "{\"type\":\"%s\",\"from\":\"%s\",\"to\":\"%s\",\"topic\":\"%s\",\"corr\":%llu,\"body\":\"%s\"}",
    m->type, m->from, m->to, m->topic, (unsigned long long)m->corr, m->body);
}

int hk_msg_decode(const char *json, size_t len, hk_message_t *m) {
  /* Simplified: assumes well-formed JSON */
  memset(m, 0, sizeof(hk_message_t));

  /* Extract fields via string search (production: use proper JSON parser) */
  const char *type_start = strstr(json, "\"type\":\"");
  if (type_start) {
    type_start += 8;
    sscanf(type_start, "%31[^\"]", m->type);
  }

  const char *from_start = strstr(json, "\"from\":\"");
  if (from_start) {
    from_start += 8;
    sscanf(from_start, "%63[^\"]", m->from);
  }

  const char *to_start = strstr(json, "\"to\":\"");
  if (to_start) {
    to_start += 6;
    sscanf(to_start, "%63[^\"]", m->to);
  }

  const char *topic_start = strstr(json, "\"topic\":\"");
  if (topic_start) {
    topic_start += 9;
    sscanf(topic_start, "%127[^\"]", m->topic);
  }

  const char *corr_start = strstr(json, "\"corr\":");
  if (corr_start) {
    sscanf(corr_start + 7, "%llu", (unsigned long long*)&m->corr);
  }

  const char *body_start = strstr(json, "\"body\":\"");
  if (body_start) {
    body_start += 8;
    sscanf(body_start, "%8191[^\"]", m->body);
  }

  return 0;
}
