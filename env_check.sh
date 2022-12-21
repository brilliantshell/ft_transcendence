#!/usr/bin/env bash

RED='\033[0;31m'
YELLOW='\033[0;33m'
GREEN='\033[0;32m'
RESET='\033[0m'

ENV=.env
ENV_SAMPLE=.env.sample

PROJECT_ROOT=$(git rev-parse --show-toplevel)

ENV_FILE=${PROJECT_ROOT}/${ENV}
ENV_SAMPLE_FILE=${PROJECT_ROOT}/${ENV_SAMPLE}

function read_content(){
	local IFS=$'\n'
	read -r -d '' -a $2 <<<"$1"
}

[ -f $ENV_FILE ] &&
	ENV_FILE_CONTENT=$(cat $ENV_FILE)

[ -f $ENV_SAMPLE_FILE ] &&
	ENV_SAMPLE_FILE_CONTENT=$(cat $ENV_SAMPLE_FILE)

read_content "$ENV_FILE_CONTENT" ENV_FILE_CONTENT_ARRAY
read_content "$ENV_SAMPLE_FILE_CONTENT" ENV_SAMPLE_FILE_CONTENT_ARRAY

ENV_KEYS=()
for j in ${!ENV_FILE_CONTENT_ARRAY[@]}; do
	if [[ ${ENV_FILE_CONTENT_ARRAY[$j]} == \#* ]]; then
		continue
	fi
	ENV_KEYS+=(${ENV_FILE_CONTENT_ARRAY[$j]%%=*})
done

ENV_SAMPLE_KEYS=()
for j in ${!ENV_SAMPLE_FILE_CONTENT_ARRAY[@]}; do
	if [[ ${ENV_SAMPLE_FILE_CONTENT_ARRAY[$j]} == \#* ]]; then
		continue
	fi
	ENV_SAMPLE_KEYS+=(${ENV_SAMPLE_FILE_CONTENT_ARRAY[$j]%%=*})
done

SUCCESS=true

ENV_ERROR_ARR=()
for j in ${!ENV_KEYS[@]}; do
	if [[ ! " ${ENV_SAMPLE_KEYS[@]} " =~ " ${ENV_KEYS[$j]} " ]]; then
		ENV_ERROR_ARR+=(${ENV_KEYS[$j]})
	fi
done

[ ${#ENV_ERROR_ARR[@]} -gt 0 ] && 
		echo -e "${YELLOW}WARNING: ${ENV_FILE#${PROJECT_ROOT}/} and ${ENV_SAMPLE_FILE#${PROJECT_ROOT}/} do not match!\nPlease add following keys in ${ENV_SAMPLE_FILE#${PROJECT_ROOT}/}${RESET}" >&2 && 
		printf "%s\n" "${ENV_ERROR_ARR[@]}" >&2 &&
		SUCCESS=false

ENV_SAMPLE_ERROR_ARR=()
for j in ${!ENV_SAMPLE_KEYS[@]}; do
	if [[ ! " ${ENV_KEYS[@]} " =~ " ${ENV_SAMPLE_KEYS[$j]} " ]]; then
		ENV_SAMPLE_ERROR_ARR+=(${ENV_SAMPLE_KEYS[$j]})
	fi
done

[ ${#ENV_SAMPLE_ERROR_ARR[@]} -gt 0 ] && 
		echo -e "${RED}ERROR: ${ENV_FILE#${PROJECT_ROOT}/} and ${ENV_SAMPLE_FILE#${PROJECT_ROOT}/} do not match!\nPlease add following keys in ${ENV_FILE#${PROJECT_ROOT}/}${RESET}" >&2 && 
		printf "%s\n" "${ENV_SAMPLE_ERROR_ARR[@]}" >&2 &&
		SUCCESS=false

[ "$SUCCESS" = true ] && 
		echo -e "${GREEN}SUCCESS: ${ENV_FILE#${PROJECT_ROOT}/} and ${ENV_SAMPLE_FILE#${PROJECT_ROOT}/} match${RESET}"
