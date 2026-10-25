#!/bin/bash

set -euo pipefail

mvn -B clean package -DskipTests
