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
import org.saidone.mindmaps.dto.MindMapDto;
import org.saidone.mindmaps.dto.MapGenerationRequestDto;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

import java.util.*;

@Component
@RequiredArgsConstructor
@Slf4j
public class OpenAiMapGenerationService implements MapGenerationService {
    private final ObjectMapper objectMapper;
    private final RestClient openAiRestClient;

    @Value("${app.openai.api-key:}")
    private String apiKey;

    @Value("${app.openai.model:gpt-5.4-mini}")
    private String model;

    private Map<String, Object> cachedQuizSchema;

    private static final String QUIZ_JSON_SCHEMA_TEMPLATE = """
            {
              "type": "object",
              "additionalProperties": false,
              "required": ["title", "stylePreset", "nodes"],
              "properties": {
                "title": { "type": "string" },
                "stylePreset": { "type": "string" },
                "nodes": {
                  "type": "array",
                  "minItems": 1,
                  "items": {
                    "type": "object",
                    "additionalProperties": false,
                    "required": ["text", "description", "emoji", "branchText", "imageUri", "imageKeywords", "parentId"],
                    "properties": {
                      "text": { "type": "string" },
                      "description": { "type": "string" },
                      "emoji": { "type": "string" },
                      "branchText": { "type": "string" },
                      "imageUri": { "type": "string" },
                      "imageKeywords": {
                        "type": "array",
                        "minItems": 3,
                        "maxItems": 4,
                        "items": { "type": "string" }
                      },
                      "parentId": { "type": ["integer", "null"] }
                    }
                  }
                }
              }
            }
            """;

    @PostConstruct
    void initSchema() {
        try {
            objectMapper.readTree(QUIZ_JSON_SCHEMA_TEMPLATE);
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
        val userPrompt = """
                Crea una mindmap in italiano e rispondi SOLO con JSON valido compatibile con MindMapDto.
                Campi obbligatori: title (string), stylePreset (string), nodes (array).
                Ogni node deve avere: text (titolo), description (breve descrizione/curiosità), emoji, branchText, imageUri, parentId.

                Vincoli:
                - Argomento: %s
                - Profondità massima della mappa (livelli gerarchici): %d
                - Il primo nodo rappresenta il tema centrale.
                - text deve essere sempre un titolo breve (2-6 parole).
                - description è OBBLIGATORIA per ogni nodo: una sola frase breve con descrizione o curiosità utile.
                - Non lasciare mai description vuota o generica (es. "descrizione", "nodo", "...").
                - I nodi successivi devono essere brevi, non duplicati e coerenti col tema.
                - %s
                - imageUri deve essere sempre stringa vuota.
                - imageKeywords deve contenere 2-6 keyword in inglese, separate da virgola, in ordine di importanza (la più importante per prima), pensate per cercare immagini su Wikimedia Commons.
                - parentId: null solo per il nodo principale (primo elemento).
                - Per gli altri nodi, parentId deve contenere l'indice (0-based) di un nodo precedente nella lista.
                - Struttura gerarchica obbligatoria: radice -> figli -> nipoti -> livelli successivi.
                - Albero n-ario: sia la radice sia ogni figlio possono avere più figli (0..n).
                - Evita collegamenti incrociati o riassegnazioni ambigue: ogni nodo deve avere un solo parentId.
                - Ordina i nodi per livelli (prima i figli della radice, poi i figli dei figli, ecc.).
                - I collegamenti devono rispettare una relazione "è un tipo/sottoinsieme di" oppure "è una parte di" coerente semanticamente.
                - Vietato creare catene tassonomiche errate (esempio: "Uccelli" figlio di "Mammiferi" è sempre sbagliato).
                - Le grandi categorie parallele (es. Mammiferi, Uccelli, Rettili, Pesci, Insetti) devono essere sorelle con lo stesso parentId, non una figlia dell'altra.
                - Prima di rispondere, fai un controllo di coerenza semantica di tutti gli archi padre->figlio e correggi eventuali errori.
                - Non superare la profondità massima richiesta: massimo %d livelli dal nodo radice.
                - Se la mappa raggiunge il livello massimo in almeno un ramo, tutti i rami principali devono raggiungere lo stesso livello massimo.
                - Evita rami principali tronchi: quando possibile, completa ogni ramo con nodi coerenti fino al livello massimo richiesto.

                Testo di riferimento allegato (se presente):
                %s
                """.formatted(
                request.getTopic(),
                request.getMaxDepth() == null ? 3 : request.getMaxDepth(),
                includeBranchText
                        ? "branchText deve essere una breve nota utile (non usare qui la descrizione principale)."
                        : "branchText è opzionale e deve essere sempre una stringa vuota (\"\") per tutti i nodi.",
                request.getMaxDepth() == null ? 3 : request.getMaxDepth(),
                StringUtils.hasText(request.getReferenceText()) ? request.getReferenceText() : "N/A"
        );

        val payload = new HashMap<String, Object>();
        payload.put("model", model);
        payload.put("response_format", responseFormat());
        payload.put("messages", List.of(
                Map.of("role", "system", "content", "Sei un assistente che crea mindmap didattiche accurate in italiano."),
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
                        "schema", parseQuizSchema()
                )
        );
    }

    private Map<String, Object> parseQuizSchema() {
        if (cachedQuizSchema != null) {
            return cachedQuizSchema;
        }
        try {
            val schema = objectMapper.readValue(QUIZ_JSON_SCHEMA_TEMPLATE, new TypeReference<Map<String, Object>>() {
            });
            if (!"object".equals(schema.get("type"))) {
                throw new IllegalStateException("Schema OpenAI non valido: type deve essere 'object'.");
            }
            cachedQuizSchema = schema;
            return cachedQuizSchema;
        } catch (Exception e) {
            throw new IllegalStateException("Schema JSON di OpenAI non valido.", e);
        }
    }
}
