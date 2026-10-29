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

package org.saidone.mindmaps.service;

import jakarta.annotation.PreDestroy;
import lombok.NonNull;
import lombok.val;
import org.apache.hc.client5.http.DnsResolver;
import org.apache.hc.client5.http.classic.methods.HttpGet;
import org.apache.hc.client5.http.config.ConnectionConfig;
import org.apache.hc.client5.http.config.RequestConfig;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManagerBuilder;
import org.apache.hc.core5.util.Timeout;
import org.apache.tika.Tika;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.util.Set;
import java.util.Arrays;
import java.util.Objects;

import static org.springframework.http.HttpStatus.*;

@Service
public class ImageDownloadService {
    private static final int MAX_BYTES = 25 * 1024 * 1024;
    private static final Set<String> IMAGE_TYPES = Set.of("image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml");
    private final Tika tika = new Tika();
    private final CloseableHttpClient client = HttpClients.custom()
            .setConnectionManager(PoolingHttpClientConnectionManagerBuilder.create()
                    .setDnsResolver(new PublicDnsResolver())
                    .setDefaultConnectionConfig(ConnectionConfig.custom()
                            .setConnectTimeout(Timeout.ofSeconds(5)).setSocketTimeout(Timeout.ofSeconds(15)).build())
                    .setMaxConnTotal(4).setMaxConnPerRoute(2).build())
            .setDefaultRequestConfig(RequestConfig.custom()
                    .setConnectionRequestTimeout(Timeout.ofSeconds(5)).setResponseTimeout(Timeout.ofSeconds(15)).build())
            .disableRedirectHandling().disableAutomaticRetries().disableCookieManagement().disableAuthCaching().build();

    @Value("${wikimedia.user-agent:AliceSimpleMindMaps/1.0}")
    private String userAgent;

    public record Download(byte[] data, String mediaType) {
        @Override
        public boolean equals(Object other) {
            return this == other || other instanceof Download(byte[] data1, String type)
                    && Arrays.equals(data, data1) && Objects.equals(mediaType, type);
        }

        @Override
        public int hashCode() {
            return 31 * Arrays.hashCode(data) + Objects.hashCode(mediaType);
        }

        @Override
        public @NonNull String toString() {
            return String.format("Download[data=%s, mediaType=%s]", Arrays.toString(data), mediaType);
        }
    }

    private record Result(String redirect, byte[] data) {
        @Override
        public boolean equals(Object other) {
            return this == other || other instanceof Result(String redirect1, byte[] data1)
                    && Objects.equals(redirect, redirect1) && Arrays.equals(data, data1);
        }

        @Override
        public int hashCode() {
            return 31 * Objects.hashCode(redirect) + Arrays.hashCode(data);
        }

        @Override
        public @NonNull String toString() {
            return String.format("Result[redirect=%s, data=%s]", redirect, Arrays.toString(data));
        }
    }

    public Download download(String source) {
        try {
            URI uri = URI.create(source);
            for (int redirects = 0; redirects <= 3; redirects++) {
                validateUri(uri);
                val request = new HttpGet(uri);
                request.setHeader("User-Agent", userAgent);
                request.setHeader("Accept", "image/*");
                val result = client.execute(request, response -> {
                    val status = response.getCode();
                    if (status == 301 || status == 302 || status == 303 || status == 307 || status == 308) {
                        val location = response.getFirstHeader("Location");
                        if (location == null) throw new ResponseStatusException(BAD_GATEWAY, "Il sito non ha fornito un’immagine scaricabile.");
                        return new Result(location.getValue(), null);
                    }
                    if (status != 200 || response.getEntity() == null) {
                        throw new ResponseStatusException(BAD_GATEWAY, "Il sito non consente di scaricare questa immagine.");
                    }
                    val entity = response.getEntity();
                    if (entity.getContentLength() > MAX_BYTES) throw tooLarge();
                    try (val stream = entity.getContent()) {
                        val bytes = stream.readNBytes(MAX_BYTES + 1);
                        if (bytes.length > MAX_BYTES) throw tooLarge();
                        return new Result(null, bytes);
                    }
                });
                if (result.redirect() != null) {
                    uri = uri.resolve(result.redirect());
                    continue;
                }
                val type = tika.detect(result.data());
                if (!IMAGE_TYPES.contains(type)) throw new ResponseStatusException(BAD_REQUEST, "Formato immagine non supportato.");
                return new Download(result.data(), type);
            }
            throw new ResponseStatusException(BAD_GATEWAY, "Il sito reindirizza troppe volte la richiesta.");
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(BAD_REQUEST, "Usa un link HTTP o HTTPS valido.");
        } catch (IOException ex) {
            throw new ResponseStatusException(BAD_GATEWAY, "Non riesco a scaricare l’immagine. Controlla il link e riprova.");
        }
    }

    private static ResponseStatusException tooLarge() {
        return new ResponseStatusException(PAYLOAD_TOO_LARGE, "L’immagine supera il limite di 25 MB.");
    }

    private static void validateUri(URI uri) throws UnknownHostException {
        val scheme = uri.getScheme();
        if (uri.getHost() == null || uri.getUserInfo() != null
                || !("https".equalsIgnoreCase(scheme) || "http".equalsIgnoreCase(scheme))
                || (uri.getPort() != -1 && uri.getPort() != ("https".equalsIgnoreCase(scheme) ? 443 : 80))) {
            throw new ResponseStatusException(BAD_REQUEST, "Usa un link HTTP o HTTPS pubblico, senza credenziali.");
        }
        // Literal IPs may bypass the HTTP client's DNS resolver.
        if (uri.getHost().contains(":") || uri.getHost().matches("[0-9.]+")) {
            checkPublic(InetAddress.getByName(uri.getHost()));
        }
    }

    private static void checkPublic(InetAddress address) throws UnknownHostException {
        val bytes = address.getAddress();
        val first = Byte.toUnsignedInt(bytes[0]);
        val second = Byte.toUnsignedInt(bytes[1]);
        val reservedV4 = bytes.length == 4 && (first == 0 || first >= 224
                || (first == 100 && second >= 64 && second <= 127)
                || (first == 192 && second == 0 && Byte.toUnsignedInt(bytes[2]) == 0)
                || (first == 198 && (second == 18 || second == 19)));
        val reservedV6 = bytes.length == 16 && (first & 0xe0) != 0x20;
        if (address.isAnyLocalAddress() || address.isLoopbackAddress() || address.isSiteLocalAddress()
                || address.isLinkLocalAddress() || address.isMulticastAddress() || reservedV4 || reservedV6) {
            throw new UnknownHostException("Sono consentiti solo indirizzi pubblici.");
        }
    }

    private static final class PublicDnsResolver implements DnsResolver {
        @Override
        public InetAddress[] resolve(String host) throws UnknownHostException {
            val addresses = InetAddress.getAllByName(host);
            for (val address : addresses) checkPublic(address);
            return addresses;
        }

        @Override
        public String resolveCanonicalHostname(String host) throws UnknownHostException {
            resolve(host);
            return host;
        }
    }

    @PreDestroy
    public void close() throws IOException {
        client.close();
    }
}
