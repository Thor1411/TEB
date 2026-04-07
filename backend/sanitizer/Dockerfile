FROM debian:stable-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    poppler-utils \
    qpdf \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /work

# This image is used as a sandbox for running poppler/qpdf against untrusted PDFs.
# The backend binds a work directory into /work and executes tools inside this container.
ENTRYPOINT ["/bin/sh", "-lc"]
