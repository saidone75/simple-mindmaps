/*
 * Alice's Simple Mind Maps
 * Copyright (C) 2026 Miss Alice & Saidone
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

package org.saidone.mindmaps.service.ai;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import lombok.val;
import org.saidone.mindmaps.dto.MapGenerationRequestDto;
import org.saidone.mindmaps.dto.MindMapDto;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.IllegalFormatException;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class OpenAiMapGenerationService implements MapGenerationService {
    private final ObjectMapper objectMapper;
    private final RestClient openAiRestClient;

    @Value("${app.openai.api-key:}")
    private String apiKey;

    @Value("${app.openai.model:gpt-5.4-mini}")
    private String model;

    @Value("${app.openai.system-prompt:classpath:prompts/mindmap-system.md}")
    private Resource systemPromptResource;
    private String systemPromptTemplate;

    private Map<String, Object> cachedMindMapSchema;

    private static final String MIND_MAP_JSON_SCHEMA = """
            {
              "type": "object",
              "additionalProperties": false,
              "required": ["title", "prizes", "stylePreset", "nodes"],
              "properties": {
                "title": { "type": "string" },
                "prizes": {
                  "type": "array", "minItems": 5, "maxItems": 5,
                  "items": { "type": "string", "minLength": 1, "maxLength": 120 }
                },
                "stylePreset": { "type": "string", "enum": ["CLASSIC", "TRUE_SUMMER"] },
                "nodes": {
                  "type": "array",
                  "minItems": 1,
                  "maxItems": 30,
                  "items": {
                    "type": "object",
                    "additionalProperties": false,
                    "required": ["text", "description", "hint", "hint2", "hint3", "emoji", "branchText", "imageUri", "imageKeywords", "parentId"],
                    "properties": {
                      "text": { "type": "string", "minLength": 1, "maxLength": 120 },
                      "description": { "type": "string", "minLength": 1, "maxLength": 280 },
                      "hint": { "type": "string", "minLength": 1, "maxLength": 280 },
                      "hint2": { "type": "string", "minLength": 1, "maxLength": 280 },
                      "hint3": { "type": "string", "minLength": 1, "maxLength": 280 },
                      "emoji": { "type": "string" },
                      "branchText": { "type": "string" },
                      "imageUri": { "type": "string", "enum": [""] },
                      "imageKeywords": {
                        "description": "3-4 distinct English search terms: first a concrete visual subject in 1-3 words retaining any essential civilization, era, place or species qualifier; second the map context; remaining terms are visual details. Avoid books and covers.",
                        "type": "array",
                        "minItems": 3,
                        "maxItems": 4,
                        "items": { "type": "string", "minLength": 1, "maxLength": 100 }
                      },
                      "parentId": { "type": ["integer", "null"] }
                    }
                  }
                }
              }
            }
            """;

    @PostConstruct
    void loadSystemPrompt() {
        try {
            systemPromptTemplate = systemPromptResource.getContentAsString(StandardCharsets.UTF_8);
            if (!StringUtils.hasText(systemPromptTemplate)) throw new IllegalStateException("Il system prompt è vuoto.");
            // Validate formatting at startup rather than on the first generation request.
            String.format(systemPromptTemplate, 3, "branchText è sempre vuota.");
        } catch (IOException | IllegalFormatException ex) {
            throw new IllegalStateException("Impossibile caricare o formattare il system prompt.", ex);
        }
    }

    @PostConstruct
    void initSchema() {
        try {
            objectMapper.readTree(MIND_MAP_JSON_SCHEMA);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Schema JSON di OpenAI non valido.", e);
        }
    }

    @Override
    public MindMapDto generateMindMap(MapGenerationRequestDto request) {
        if (!StringUtils.hasText(apiKey)) {
            throw new IllegalStateException("Chiave API di OpenAI non configurata. Imposta app.openai.api-key.");
        }

        val payload = buildPayload(request);
        val responseBody = openAiRestClient.post()
                .uri("/chat/completions")
                .header(HttpHeaders.AUTHORIZATION, String.format("Bearer %s", apiKey))
                .contentType(MediaType.APPLICATION_JSON)
                .body(payload)
                .retrieve()
                .body(String.class);

        try {
            val root = objectMapper.readTree(responseBody);
            val rawJson = root.path("choices").path(0).path("message").path("content").asText();
            return objectMapper.readValue(rawJson, MindMapDto.class);
        } catch (Exception e) {
            log.error("Risposta OpenAI non valida: {}", responseBody, e);
            throw new IllegalStateException("La risposta di OpenAI non è valida o è incompleta.");
        }
    }



    private Map<String, Object> buildPayload(MapGenerationRequestDto request) {
        val includeBranchText = Boolean.TRUE.equals(request.getIncludeBranchText());
        val systemPrompt = String.format(systemPromptTemplate,
                request.getMaxDepth() == null ? 3 : request.getMaxDepth(),
                includeBranchText
                        ? "branchText contiene una breve relazione tra padre e figlio, senza ripetere la description; nella radice è vuota."
                        : "branchText è sempre una stringa vuota per tutti i nodi."
        );
        val userPrompt = objectMapper.valueToTree(Map.of(
                "argomento", request.getTopic(),
                "testoDiRiferimento", StringUtils.hasText(request.getReferenceText()) ? request.getReferenceText() : ""
        )).toString();

        val payload = new HashMap<String, Object>();
        payload.put("model", model);
        payload.put("response_format", responseFormat());
        payload.put("messages", List.of(
                Map.of("role", "system", "content", systemPrompt),
                Map.of("role", "user", "content", userPrompt)
        ));
        return payload;
    }

    private Map<String, Object> responseFormat() {
        return Map.of(
                "type", "json_schema",
                "json_schema", Map.of(
                        "name", "mindmap_dto_request",
                        "strict", true,
                        "schema", parseMindMapSchema()
                )
        );
    }

    private Map<String, Object> parseMindMapSchema() {
        if (cachedMindMapSchema != null) {
            return cachedMindMapSchema;
        }
        try {
            val schema = objectMapper.readValue(MIND_MAP_JSON_SCHEMA, new TypeReference<Map<String, Object>>() {
            });
            if (!"object".equals(schema.get("type"))) {
                throw new IllegalStateException("Schema OpenAI non valido: type deve essere 'object'.");
            }
            cachedMindMapSchema = schema;
            return cachedMindMapSchema;
        } catch (Exception e) {
            throw new IllegalStateException("Schema JSON di OpenAI non valido.", e);
        }
    }
}
