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

package org.saidone.mindmaps.config;

import ai.djl.Application;
import ai.djl.MalformedModelException;
import ai.djl.huggingface.translator.TextEmbeddingTranslatorFactory;
import ai.djl.repository.zoo.Criteria;
import ai.djl.repository.zoo.ModelNotFoundException;
import ai.djl.repository.zoo.ZooModel;
import lombok.extern.slf4j.Slf4j;
import lombok.val;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.IOException;
import java.time.Duration;

@Configuration
@Slf4j
public class EmbeddingModelConfig {

    @Value("${ai.embedding.model-url:djl://ai.djl.huggingface.pytorch/sentence-transformers/all-MiniLM-L6-v2}")
    private String embeddingModelUrl;

    @Bean(destroyMethod = "close")
    public ZooModel<String, float[]> textEmbeddingModel() throws ModelNotFoundException, MalformedModelException, IOException {
        val startedAt = System.nanoTime();
        log.info("Preparo il modello che aiuta a scegliere le immagini confrontando il significato dei testi.");
        log.debug("Modello da caricare: {}. Il motore usato è PyTorch.", embeddingModelUrl);
        val criteria = Criteria.builder()
                .setTypes(String.class, float[].class)
                .optApplication(Application.NLP.TEXT_EMBEDDING)
                .optEngine("PyTorch")
                .optModelUrls(embeddingModelUrl)
                .optTranslatorFactory(new TextEmbeddingTranslatorFactory())
                .build();

        try {
            val model = criteria.loadModel();
            log.info("Il modello per confrontare i testi è pronto ({} ms).",
                    Duration.ofNanos(System.nanoTime() - startedAt).toMillis());
            log.debug("Il modello lavora su questo computer ed è riutilizzato tra le ricerche. Le risorse di ogni confronto vengono chiuse al termine.");
            return model;
        } catch (ModelNotFoundException | MalformedModelException | IOException e) {
            log.error("Non riesco a caricare il modello {} dopo {} ms.",
                    embeddingModelUrl, Duration.ofNanos(System.nanoTime() - startedAt).toMillis(), e);
            throw e;
        }
    }
}
